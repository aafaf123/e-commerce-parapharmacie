// backend/src/routes/products.js
import express from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { cloudinaryUpload } from '../utils/cloudinary.js'
import { cacheGet, cacheSet, CACHE_KEYS, invalidateProductCache } from '../utils/redisCache.js'
import prisma from '../prismaClient.js'

const router = express.Router()

// Cache en mémoire pour l'ID de la catégorie Promotions (évite une requête DB à chaque appel)
let promoCategoryId = null;
async function getPromoCategoryId() {
  if (promoCategoryId !== undefined && promoCategoryId !== null) return promoCategoryId;
  const cat = await prisma.category.findFirst({ where: { name: 'Promotions' }, select: { id: true } });
  promoCategoryId = cat?.id ?? false;
  return promoCategoryId;
}

// Configurer multer pour les uploads en mémoire
const upload = multer({ storage: multer.memoryStorage() })

// Helper: Check if product is new (created within 48 hours)
function isProductNew(createdAt) {
  if (!createdAt) return false;
  const now = new Date();
  const created = new Date(createdAt);
  const hoursDiff = (now - created) / (1000 * 60 * 60);
  return hoursDiff <= 48;
}

// Normalize: remove accents and lowercase
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Levenshtein distance (capped at maxDist for performance)
function levenshtein(a, b, maxDist = 3) {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[a.length][b.length]
}

// Check if query fuzzy-matches a field: substring OR word-level Levenshtein
function fuzzyMatch(field, q) {
  const f = normalize(field)
  if (!f || !q) return { match: false, score: 0 }
  // Exact substring
  if (f.includes(q)) return { match: true, score: 2 }
  // Word-level fuzzy: each word in field vs query
  const words = f.split(/\s+/)
  const maxAllowed = q.length <= 4 ? 1 : 2
  for (const word of words) {
    const dist = levenshtein(word, q, maxAllowed)
    if (dist <= maxAllowed) return { match: true, score: 1 }
  }
  return { match: false, score: 0 }
}

// Score a product against the normalized query
function scoreProduct(query, product) {
  const q = normalize(query)
  if (!q) return 0

  const nameMatch  = fuzzyMatch(product.name, q)
  const brandMatch = fuzzyMatch(product.brand, q)
  const catMatch   = fuzzyMatch(product.category?.name, q)
  const barcodeMatch = fuzzyMatch(product.barcode, q)

  if (!nameMatch.match && !brandMatch.match && !catMatch.match && !barcodeMatch.match) return 0

  let score = 0
  // Name: weight ×3, bonus if starts with query
  if (nameMatch.match) {
    score += nameMatch.score === 2 ? 300 : 150
    if (normalize(product.name).startsWith(q)) score += 50
  }
  // Brand: weight ×2
  if (brandMatch.match) score += brandMatch.score === 2 ? 200 : 100
  // Category: weight ×1
  if (catMatch.match)   score += catMatch.score === 2 ? 100 : 50
  // Barcode: weight ×2
  if (barcodeMatch.match) score += barcodeMatch.score === 2 ? 200 : 100

  return score
}

// GET /products/brands - Récupérer toutes les marques actives (public)
router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      where: { active: true },
      include: {
        _count: {
          select: { products: { where: { active: true } } }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filtrer les marques qui ont au moins un produit actif
    const brandsWithProducts = brands.filter(brand => brand._count.products > 0);

    res.json(brandsWithProducts);
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET - Export all products (before /:id routes)
router.get('/export', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        subcategory: true,
        productVariants: {
          include: {
            variantType: true,
            variantValue: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
    res.json(products)
  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({ message: 'Erreur export' })
  }
})

// GET /products/search - Advanced search with categories, subcategories, brands and products
router.get('/search', async (req, res) => {
  try {
    const { q = '', limit = 7 } = req.query
    const query = q.trim()
    
    if (query.length < 1) {
      return res.json({ results: [], suggestion: null })
    }

    console.log('🔍 Search query:', query)
    const normalizedQuery = normalize(query)
    console.log('📝 Normalized query:', normalizedQuery)

    // Fetch all active products
    const allProducts = await prisma.product.findMany({
      where: {
        active: true,
        NOT: { category: { name: 'Promotions' } }
      },
      select: {
        id: true, name: true, brand: true, price: true, oldPrice: true,
        image: true, stock: true, barcode: true,
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, title: true } }
      }
    })

    console.log('📦 Found', allProducts.length, 'products')

    // Fetch all categories
    const allCategories = await prisma.category.findMany({
      where: { NOT: { name: 'Promotions' } },
      select: { id: true, name: true }
    })

    console.log('📂 Found', allCategories.length, 'categories')

    // Fetch all subcategories
    const allSubcategories = await prisma.subcategory.findMany({
      select: { id: true, title: true, categoryId: true }
    })

    console.log('📋 Found', allSubcategories.length, 'subcategories')

    // Fetch all unique brands
    const allBrands = await prisma.product.findMany({
      where: { active: true, brand: { not: null } },
      select: { brand: true },
      distinct: ['brand']
    })

    console.log('🏷️ Found', allBrands.length, 'brands')

    // Score and filter products
    const scoredProducts = allProducts
      .map(p => ({ ...p, _score: scoreProduct(query, p), _type: 'product' }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)

    console.log('✅ Matched products:', scoredProducts.length)
    if (scoredProducts.length > 0) {
      console.log('   Top match:', scoredProducts[0].name, 'score:', scoredProducts[0]._score)
    }

    // Score and filter categories
    const scoredCategories = allCategories
      .map(c => {
        const match = fuzzyMatch(c.name, normalizedQuery)
        let score = 0
        if (match.match) {
          score = match.score === 2 ? 150 : 100
          if (normalize(c.name).startsWith(normalizedQuery)) score += 50
        }
        return { ...c, _score: score, _type: 'category' }
      })
      .filter(c => c._score > 0)
      .sort((a, b) => b._score - a._score)

    console.log('✅ Matched categories:', scoredCategories.length)

    // Score and filter subcategories - using fuzzyMatch like products
    const scoredSubcategories = allSubcategories
      .map(sc => {
        const match = fuzzyMatch(sc.title, normalizedQuery)
        let score = 0
        if (match.match) {
          score = match.score === 2 ? 120 : 80
          if (normalize(sc.title).startsWith(normalizedQuery)) score += 40
        }
        return { ...sc, _score: score, _type: 'subcategory' }
      })
      .filter(sc => sc._score > 0)
      .sort((a, b) => b._score - a._score)

    console.log('✅ Matched subcategories:', scoredSubcategories.length)

    // Score and filter brands
    const scoredBrands = allBrands
      .filter(b => b.brand) // Only non-null brands
      .map(b => {
        const bNorm = normalize(b.brand)
        let score = 0
        if (bNorm.includes(normalizedQuery)) score = 100
        else if (bNorm.startsWith(normalizedQuery)) score = 80
        else {
          const dist = levenshtein(bNorm, normalizedQuery, 2)
          if (dist <= 2) score = 40
        }
        return { name: b.brand, _score: score, _type: 'brand' }
      })
      .filter(b => b._score > 0)
      .sort((a, b) => b._score - a._score)

    console.log('✅ Matched brands:', scoredBrands.length)

    // Combine all results with better distribution
    // Give priority to: products > categories >= subcategories > brands
    const results = []
    const maxProducts = Math.ceil(limit * 0.5)      // 50% products
    const maxCategories = Math.ceil(limit * 0.2)    // 20% categories
    const maxSubcategories = Math.ceil(limit * 0.2) // 20% subcategories
    const maxBrands = Math.ceil(limit * 0.1)        // 10% brands
    
    results.push(...scoredProducts.slice(0, maxProducts).map(({ _score, _type, ...p }) => ({ ...p, resultType: 'product' })))
    results.push(...scoredCategories.slice(0, maxCategories).map(({ _score, _type, ...c }) => ({ ...c, resultType: 'category' })))
    // Normalize subcategories: map 'title' to 'name' for consistent JSON
    results.push(...scoredSubcategories.slice(0, maxSubcategories).map(({ _score, _type, title, ...sc }) => ({ 
      ...sc, 
      name: title,  // Rename title to name for consistency
      resultType: 'subcategory'
    })))
    results.push(...scoredBrands.slice(0, maxBrands).map(({ _score, _type, ...b }) => ({ ...b, resultType: 'brand' })))

    console.log('🎯 Distribution:', {
      products: Math.min(scoredProducts.length, maxProducts),
      categories: Math.min(scoredCategories.length,  maxCategories),
      subcategories: Math.min(scoredSubcategories.length, maxSubcategories),
      brands: Math.min(scoredBrands.length, maxBrands)
    })
    console.log('🎯 Total results returned:', results.length)

    res.json({ results: results.slice(0, limit), suggestion: null })
  } catch (error) {
    console.error('❌ Search error:', error)
    res.status(500).json({ results: [], suggestion: null })
  }
})

// GET - Récupérer tous les produits avec pagination
router.get('/', async (req, res) => {
  try {
    const {
      category,
      categoryId,
      brand,
      brandId,
      subcategory,
      subcategoryId,
      subcategoryItemId,
      search,
      page = 1,
      limit = 12,
      active,
      outOfStock,
      includeSupplierInfo
    } = req.query

    const where = {}
    
    // Only filter by active=true for public API (when active param is not provided)
    if (active === 'all') {
      // No filter - return all products (admin use)
    } else if (active !== undefined) {
      where.active = active === 'true'
    } else {
      where.active = true
    }

    // Exclure la catégorie "Promotions" des listes publiques (pas en mode admin)
    if (active !== 'all') {
      const promoCatId = await getPromoCategoryId();
      if (promoCatId) {
        where.NOT = { categoryId: promoCatId };
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // Filter by category ID
    if (categoryId) {
      where.categoryId = categoryId
    }
    
    // Filter by category name
    if (category) {
      where.category = { name: { equals: category, mode: 'insensitive' } }
    }
    
    // Filter by subcategory ID
    if (subcategoryId) {
      where.subcategoryId = subcategoryId
    }
    
    // Filter by subcategory item ID
    if (subcategoryItemId) {
      where.subcategoryItemId = subcategoryItemId
    }
    
    // Filter by brand ID
    if (brandId) {
      where.brandId = brandId
    }
    
    // Filter by brand name
    if (brand) {
      where.brand = { contains: brand, mode: 'insensitive' }
    }
    
    // Filter out of stock products
    if (outOfStock === 'true') {
      where.stock = { lte: 0 }
    }

    // subcategory param = item name from CategoryBar
    // Look up the SubcategoryItem by name and filter by subcategoryItemId
    if (subcategory) {
      const item = await prisma.subcategoryItem.findFirst({
        where: { name: { equals: subcategory, mode: 'insensitive' } }
      })
      if (item) {
        where.subcategoryItemId = item.id
      } else {
        // Fallback: also try matching subcategory title
        const sub = await prisma.subcategory.findFirst({
          where: { title: { equals: subcategory, mode: 'insensitive' } }
        })
        if (sub) {
          where.subcategoryId = sub.id
        } else {
          // Last fallback: text search in name/description
          where.OR = [
            { name:        { contains: subcategory, mode: 'insensitive' } },
            { description: { contains: subcategory, mode: 'insensitive' } }
          ]
        }
      }
    }

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Build cache key (only for public requests without filters)
    const hasFilters = category || categoryId || brand || brandId || subcategory || subcategoryId || subcategoryItemId || search || outOfStock;
    const cacheKey = (!hasFilters && active !== 'all') ? CACHE_KEYS.PRODUCTS_LIST_PAGE(page) : null;
    
    // Try cache first
    if (cacheKey) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    // Fetch and paginate
    let products, total

    if (search) {
      ;[products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true, name: true, brand: true, price: true, oldPrice: true,
            image: true, stock: true, barcode: true, active: true, createdAt: true,
            category: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.product.count({ where })
      ])
    } else {
      ;[products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: {
              include: {
                subcategories: {
                  select: {
                    id: true,
                    title: true,
                    items: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            brandModel: true,
            productImages: { orderBy: { order: 'asc' }, take: 1 },
            subcategory: true,
            subcategoryItem: true,
            productVariants: {
              include: {
                variantType: true,
                variantValue: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.product.count({ where })
      ])
    }
    
    // Add isNew field to each product
    let productsWithNewFlag = products.map(p => ({
      ...p,
      isNew: isProductNew(p.createdAt)
    }));

    // Add supplier info if requested (for admin)
    if (includeSupplierInfo === 'true') {
      const productIds = productsWithNewFlag.map(p => p.id);
      
      // Get main supplier for each product (most recent purchase order)
      const supplierInfo = await Promise.all(
        productIds.map(async (productId) => {
          // Get main supplier (most recent purchase order)
          const recentPurchase = await prisma.purchaseOrderItem.findFirst({
            where: { productId },
            include: {
              purchaseOrder: {
                include: {
                  supplier: { select: { name: true } }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          });
          
          // Get last restock date (most recent received purchase order)
          const lastRestock = await prisma.purchaseOrderItem.findFirst({
            where: { 
              productId,
              purchaseOrder: { status: { in: ['RECEIVED', 'REÇU_TOTAL', 'REÇU_PARTIEL'] } }
            },
            include: {
              purchaseOrder: { select: { receivedDate: true } }
            },
            orderBy: { updatedAt: 'desc' }
          });
          
          // Get last sale date
          const lastSale = await prisma.stockMovement.findFirst({
            where: { 
              productId,
              type: 'SALE'
            },
            orderBy: { createdAt: 'desc' }
          });
          
          return {
            productId,
            mainSupplier: recentPurchase?.purchaseOrder?.supplier?.name || null,
            lastRestock: lastRestock?.purchaseOrder?.receivedDate || null,
            lastSale: lastSale?.createdAt || null
          };
        })
      );
      
      // Merge supplier info with products
      productsWithNewFlag = productsWithNewFlag.map(product => {
        const info = supplierInfo.find(s => s.productId === product.id);
        return {
          ...product,
          mainSupplier: info?.mainSupplier,
          lastRestock: info?.lastRestock,
          lastSale: info?.lastSale
        };
      });
    }

    // Response object
    const response = {
      products: productsWithNewFlag,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasMore: skip + products.length < total
      }
    };

    // Cache the response (only for public requests)
    if (cacheKey) {
      await cacheSet(cacheKey, response, 1800); // 30 min
    }

    // Retourner avec pagination
    res.json(response)
  } catch (error) {
    console.error('Erreur récupération produits:', error)
    res.status(500).json({ 
      products: [],
      pagination: { currentPage: 1, totalPages: 1, total: 0, hasMore: false },
      message: 'Erreur serveur' 
    })
  }
})

// GET /products/:id/similar - Produits similaires intelligents
router.get('/:id/similar', async (req, res) => {
  try {
    const { id } = req.params
    const limit = parseInt(req.query.limit) || 8

    // Récupérer le produit de référence avec toutes ses informations
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
        subcategoryItem: true,
        brandModel: true
      }
    })
    
    if (!product) return res.status(404).json([])

    // Récupérer les candidats potentiels (même catégorie, exclure le produit actuel)
    const candidates = await prisma.product.findMany({
      where: { 
        active: true, 
        categoryId: product.categoryId, 
        id: { not: id },
        stock: { gt: 0 } // Seulement les produits en stock
      },
      include: {
        category: true,
        subcategory: true,
        subcategoryItem: true,
        brandModel: true
      },
      take: 50 // Limiter pour les performances
    })

    // Algorithme de scoring intelligent
    const scored = candidates.map(candidate => {
      let score = 10 // Score de base : même catégorie
      
      // 1. Même marque = +30 points (très important)
      if (product.brand && candidate.brand && 
          product.brand.toLowerCase() === candidate.brand.toLowerCase()) {
        score += 30
      }
      
      // 2. Même sous-catégorie = +25 points
      if (product.subcategoryId && candidate.subcategoryId && 
          product.subcategoryId === candidate.subcategoryId) {
        score += 25
      }
      
      // 3. Même item de sous-catégorie = +20 points
      if (product.subcategoryItemId && candidate.subcategoryItemId && 
          product.subcategoryItemId === candidate.subcategoryItemId) {
        score += 20
      }
      
      // 4. Même type de produit = +15 points
      if (product.type && candidate.type && 
          product.type.toLowerCase() === candidate.type.toLowerCase()) {
        score += 15
      }
      
      // 5. Gamme de prix similaire = +10 points
      const productPrice = product.priceHT || product.price || 0
      const candidatePrice = candidate.priceHT || candidate.price || 0
      if (productPrice > 0 && candidatePrice > 0) {
        const priceDiff = Math.abs(productPrice - candidatePrice) / productPrice
        if (priceDiff <= 0.3) { // ±30% de différence
          score += 10
        } else if (priceDiff <= 0.5) { // ±50% de différence
          score += 5
        }
      }
      
      // 6. Mots-clés similaires dans le nom = +5 à +15 points
      if (product.name && candidate.name) {
        const productWords = product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const candidateWords = candidate.name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        
        let commonWords = 0
        productWords.forEach(word => {
          if (candidateWords.some(cw => cw.includes(word) || word.includes(cw))) {
            commonWords++
          }
        })
        
        if (commonWords > 0) {
          score += Math.min(commonWords * 5, 15) // Max 15 points
        }
      }
      
      // 7. Bonus pour les produits bien notés = +5 points
      if (candidate.rating && candidate.rating >= 4) {
        score += 5
      }
      
      // 8. Bonus pour les nouveaux produits = +3 points
      if (candidate.createdAt) {
        const daysSinceCreation = (new Date() - new Date(candidate.createdAt)) / (1000 * 60 * 60 * 24)
        if (daysSinceCreation <= 30) { // Nouveau produit (moins de 30 jours)
          score += 3
        }
      }
      
      // 9. Malus pour les produits en rupture de stock
      if (candidate.stock <= candidate.stockAlert) {
        score -= 5
      }
      
      return { 
        ...candidate, 
        _score: score,
        _reasons: [] // Pour le debug si nécessaire
      }
    })

    // Trier par score décroissant et prendre les meilleurs
    const results = scored
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, _reasons, category, subcategory, subcategoryItem, brandModel, ...product }) => ({
        ...product,
        // Garder seulement les champs nécessaires pour l'affichage
        category: category ? { id: category.id, name: category.name } : null,
        brand: product.brand || brandModel?.name || null
      }))

    res.json(results)
  } catch (error) {
    console.error('Similar products error:', error)
    res.status(500).json([])
  }
})

// GET - Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.PRODUCT_DETAIL(req.params.id);
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        brandModel: true,
        productImages: { orderBy: { order: 'asc' } },
        productVariants: {
          where: { active: true },
          include: { variantType: true, variantValue: true }
        }
      }
    })

    if (!product) return res.status(404).json({ message: 'Produit non trouvé' })

    await cacheSet(cacheKey, product, 1800); // 30 min
    res.json(product)
  } catch (error) {
    console.error('Erreur récupération produit:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// POST - Créer un produit (admin seulement)
router.post('/', async (req, res) => {
  try {
    const {
      name, description, usage, composition, benefits,
      price, priceHT, oldPrice, oldPriceHT, taxRate,
      image, brand, brandId, sku,
      stock, stockAlert, categoryId, subcategoryId, subcategoryItemId,
      type, images, variants, active, barcode, expiryDate
    } = req.body
    
    // Gérer la marque automatiquement
    let finalBrandId = brandId;
    if (brand && !brandId) {
      let brandModel = await prisma.brand.findFirst({
        where: { name: { equals: brand.trim(), mode: 'insensitive' } }
      });
      if (!brandModel) {
        const formattedName = brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1).toLowerCase();
        brandModel = await prisma.brand.create({ data: { name: formattedName, active: true } });
      }
      finalBrandId = brandModel.id;
    }
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        usage,
        composition,
        benefits: benefits ? (Array.isArray(benefits) ? benefits : JSON.parse(benefits)) : [],
        price: parseFloat(priceHT || price) * (1 + parseFloat(taxRate || 20) / 100),
        priceHT: parseFloat(priceHT || price),
        priceTTC: parseFloat(priceHT || price) * (1 + parseFloat(taxRate || 20) / 100),
        oldPrice: oldPriceHT ? parseFloat(oldPriceHT) * (1 + parseFloat(taxRate || 20) / 100) : (oldPrice ? parseFloat(oldPrice) : null),
        oldPriceHT: oldPriceHT ? parseFloat(oldPriceHT) : (oldPrice ? parseFloat(oldPrice) / (1 + parseFloat(taxRate || 20) / 100) : null),
        taxRate: taxRate ? parseFloat(taxRate) : 20,
        image: image ? await cloudinaryUpload(image) : null,
        brand,
        brandId: finalBrandId,
        sku,
        stock: parseInt(stock) || 0,
        stockAlert: parseInt(stockAlert) || 10,
        categoryId,
        subcategoryId: subcategoryId || null,
        subcategoryItemId: subcategoryItemId || null,
        type,
        images: images && images !== '' ? (Array.isArray(images) ? images : JSON.parse(images)) : [],
        active: active !== undefined ? active : true,
        barcode: barcode || null,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null
      },
      include: {
        category: true,
        brandModel: true,
        productVariants: {
          include: {
            variantType: true,
            variantValue: true
          }
        }
      }
    })
    
    // Create variants if provided
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantsToCreate = []
      
      variants.forEach(v => {
        // VÉRIFICATION CRITIQUE : NE PARSER SEULEMENT SI C'EST UN FORMAT TEXTE LIBRE
        if (typeof v.value === 'string' && (v.value.includes(':') || v.value.includes('|'))) {
          // C'est le format texte libre, on parse
          const parsedVariants = parseVariantsString(v)
          parsedVariants.forEach(variant => {
            // Handle priceHT and priceTTC for parsed variants
            let variantPrice = null
            let variantPriceHT = null
            let variantPriceTTC = null

            if (variant.priceHT !== undefined && variant.priceHT !== null) {
              variantPriceHT = parseFloat(variant.priceHT)
              variantPriceTTC = variantPriceHT * (1 + parseFloat(taxRate || 20) / 100)
              variantPrice = variantPriceTTC
            } else if (variant.priceTTC !== undefined && variant.priceTTC !== null) {
              variantPriceTTC = parseFloat(variant.priceTTC)
              variantPriceHT = variantPriceTTC / (1 + parseFloat(taxRate || 20) / 100)
              variantPrice = variantPriceTTC
            } else if (variant.price !== undefined && variant.price !== null) {
              variantPrice = parseFloat(variant.price)
              variantPriceTTC = variantPrice
              variantPriceHT = variantPrice / (1 + parseFloat(taxRate || 20) / 100)
            }

            variantsToCreate.push({
              productId: product.id,
              variantTypeId: variant.variantTypeId || null,
              variantValueId: variant.variantValueId || null,
              type: variant.type || 'taille',
              value: variant.value || '',
              priceHT: variantPriceHT,
              priceTTC: variantPriceTTC,
              priceAdjustment: 0,
              stock: parseInt(variant.stock) || 0,
              image: variant.image && variant.image !== '' ? variant.image : null,
              description: variant.description || null,
              barcode: variant.barcode && variant.barcode !== '' ? variant.barcode : null,
              expiryDate: variant.expiryDate ? (() => { try { return new Date(variant.expiryDate).toISOString() } catch { return null } })() : null,
              active: v.active !== false
            })
          })
        } else {
          // C'est un variant NORMAL, déjà structuré, on l'ajoute TEL QUEL
          // Handle priceHT and priceTTC for normal variants
          let variantPrice = null
          let variantPriceHT = null
          let variantPriceTTC = null

          if (v.priceHT !== undefined && v.priceHT !== null) {
            variantPriceHT = parseFloat(v.priceHT)
            variantPriceTTC = variantPriceHT * (1 + parseFloat(taxRate || 20) / 100)
            variantPrice = variantPriceTTC
          } else if (v.priceTTC !== undefined && v.priceTTC !== null) {
            variantPriceTTC = parseFloat(v.priceTTC)
            variantPriceHT = variantPriceTTC / (1 + parseFloat(taxRate || 20) / 100)
            variantPrice = variantPriceTTC
          } else if (v.price !== undefined && v.price !== null) {
            variantPrice = parseFloat(v.price)
            variantPriceTTC = variantPrice
            variantPriceHT = variantPrice / (1 + parseFloat(taxRate || 20) / 100)
          }

          variantsToCreate.push({
            productId: product.id,
            variantTypeId: v.variantTypeId || null,
            variantValueId: v.variantValueId || null,
            type: v.type || 'taille',
            value: v.value || '',
            priceHT: variantPriceHT,
            priceTTC: variantPriceTTC,
            priceAdjustment: 0,
            stock: parseInt(v.stock) || 0,
            image: v.image && v.image !== '' ? v.image : null,
            description: v.description || null,
            barcode: v.barcode && v.barcode !== '' ? v.barcode : null,
            expiryDate: v.expiryDate ? (() => { try { return new Date(v.expiryDate).toISOString() } catch { return null } })() : null,
            active: v.active !== false
          })
        }
      })
      
      if (variantsToCreate.length > 0) {
        await prisma.productVariant.createMany({
          data: variantsToCreate
        })
      }
    }

    function parseVariantsString(v) {
      if (!v || !v.value) return []
      
      // Format: type:value:price:stock:image:barcode:expiryDate | type:value:price:stock:image:barcode:expiryDate
      const parts = v.value.split('|')
      const variants = []
      
      parts.forEach(part => {
        part = part.trim()
        if (!part) return
        
        const variant = {}
        
        // Extraire type et valeur (ex: "volume:50ml")
        const match = part.match(/^([^:]+):(.+)$/)
        if (match) {
          const [, type, value] = match
          variant.type = type.trim()
          variant.value = value.trim()
        }
        
        // Extraire les autres champs par position
        const fields = part.split(':').filter(f => f.trim())
        if (fields.length >= 2) {
          variant.variantTypeId = fields[0] || null
          variant.variantValueId = fields[1] || null
          if (fields[2]) variant.price = fields[2]
          if (fields[3]) variant.stock = fields[3]
          if (fields[4] && fields[4].trim() !== '') variant.image = fields[4].trim()
          if (fields[5] && fields[5].trim() !== '') variant.barcode = fields[5].trim()
          if (fields[6] && fields[6].trim() !== '') variant.expiryDate = fields[6].trim()
        }
        
        variants.push(variant)
      })
      
      return variants
    }

    // Fetch product with variants
    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        brandModel: true,
            productVariants: {
              include: {
                variantType: true,
                variantValue: true
              }
            }
      }
    })

    // Invalidate cache after creation
    await invalidateProductCache();

    res.status(201).json(fullProduct)
  } catch (error) {
    console.error('Erreur création produit:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// PUT - Mettre à jour un produit (admin seulement)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      name, description, usage, composition, benefits,
      price, priceHT, oldPrice, oldPriceHT, taxRate,
      image, brand, brandId, sku,
      rating, reviews, stock, stockAlert,
      categoryId, subcategoryId, subcategoryItemId,
      type, images, variants, active, barcode, expiryDate
    } = req.body
    
    // Récupérer le produit existant
    const existingProduct = await prisma.product.findUnique({ where: { id } })
    if (!existingProduct) {
      return res.status(404).json({ message: 'Produit non trouvé' })
    }
    
    // Gérer la marque automatiquement
    let finalBrandId = brandId;
    if (brand !== undefined && brand && !brandId) {
      let brandModel = await prisma.brand.findFirst({
        where: { name: { equals: brand.trim(), mode: 'insensitive' } }
      });
      if (!brandModel) {
        const formattedName = brand.trim().charAt(0).toUpperCase() + brand.trim().slice(1).toLowerCase();
        brandModel = await prisma.brand.create({ data: { name: formattedName, active: true } });
      }
      finalBrandId = brandModel.id;
    }
    
    // Validate categoryId if provided
    if (categoryId !== undefined && categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      if (!category) {
        return res.status(400).json({ message: 'Catégorie invalide' })
      }
    }
    
    // Validate subcategoryId if provided
    if (subcategoryId !== undefined && subcategoryId) {
      const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } })
      if (!subcategory) {
        return res.status(400).json({ message: 'Sous-catégorie invalide' })
      }
    }
    
    // Validate subcategoryItemId if provided
    if (subcategoryItemId !== undefined && subcategoryItemId) {
      const item = await prisma.subcategoryItem.findUnique({ where: { id: subcategoryItemId } })
      if (!item) {
        return res.status(400).json({ message: 'Item invalide' })
      }
    }
    
    // Déterminer le taxRate final: utiliser le nouveau ou conserver l'existant
    const finalTaxRate = taxRate !== undefined ? parseFloat(taxRate) : existingProduct.taxRate
    
    // Déterminer le priceHT final: utiliser le nouveau ou conserver l'existant
    const finalPriceHT = priceHT !== undefined ? parseFloat(priceHT) : existingProduct.priceHT
    
    // Calculer priceTTC basé sur le priceHT et taxRate finaux
    const priceTTC = finalPriceHT * (1 + finalTaxRate / 100)
    
    // Gérer oldPrice/oldPriceHT
    let oldPriceHTFinal = oldPriceHT !== undefined ? parseFloat(oldPriceHT) : existingProduct.oldPriceHT
    let oldPriceTTC = oldPriceHTFinal ? oldPriceHTFinal * (1 + finalTaxRate / 100) : null
    
    // Build data object with only defined fields
    const updateData = {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      usage: usage !== undefined ? usage : undefined,
      composition: composition !== undefined ? composition : undefined,
      benefits: benefits !== undefined ? (Array.isArray(benefits) ? benefits : (benefits ? JSON.parse(benefits) : [])) : undefined,
      price: priceTTC,
      priceHT: finalPriceHT,
      priceTTC: priceTTC,
      oldPrice: oldPriceTTC,
      oldPriceHT: oldPriceHTFinal,
      taxRate: finalTaxRate,
      image: image !== undefined ? image : undefined,
      brand: brand !== undefined && brand ? brand : undefined,
      brandId: finalBrandId !== undefined ? finalBrandId : (brandId !== undefined ? brandId : undefined),
      sku: sku !== undefined && sku ? sku : undefined,
      rating: rating !== undefined ? parseFloat(rating) : undefined,
      reviews: reviews !== undefined ? parseInt(reviews) : undefined,
      stock: stock !== undefined ? parseInt(stock) : undefined,
      stockAlert: stockAlert !== undefined ? parseInt(stockAlert) : undefined,
      categoryId: categoryId !== undefined ? categoryId : undefined,
      subcategoryId: subcategoryId !== undefined ? (subcategoryId || null) : undefined,
      subcategoryItemId: subcategoryItemId !== undefined ? (subcategoryItemId || null) : undefined,
      type: type !== undefined ? type : undefined,
      images: images !== undefined ? (Array.isArray(images) ? images : JSON.parse(images)) : undefined,
      active: active !== undefined ? active : undefined,
      expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate).toISOString() : null) : undefined,
      barcode: barcode !== undefined ? (barcode || null) : undefined
    }
    
    // Remove undefined values to avoid overwriting with undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key])
    
    // Update product basic fields
    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        brandModel: true,
            productVariants: {
              include: {
                variantType: true,
                variantValue: true
              }
            }
      }
    })
    
    // Handle variants update if provided
    if (variants !== undefined && Array.isArray(variants)) {
      // Delete all existing variants and recreate
      await prisma.productVariant.deleteMany({
        where: { productId: id }
      })
      
      if (variants.length > 0) {
        // Filter out invalid variants
        const validVariants = variants.filter(v => v && v.value)
        if (validVariants.length > 0) {
        const variantsToCreate = validVariants.map(v => {
        // For update, variants are already structured objects, not strings
        const parsed = typeof v === 'string' ? parseVariantString(v) : v

        // Handle priceHT and priceTTC for variants in update
        let variantPrice = null
        let variantPriceHT = null
        let variantPriceTTC = null

        if (parsed.priceHT !== undefined && parsed.priceHT !== null && parsed.priceHT !== '') {
          variantPriceHT = parseFloat(parsed.priceHT)
          variantPriceTTC = variantPriceHT * (1 + finalTaxRate / 100)
          variantPrice = variantPriceTTC
        } else if (parsed.priceTTC !== undefined && parsed.priceTTC !== null && parsed.priceTTC !== '') {
          variantPriceTTC = parseFloat(parsed.priceTTC)
          variantPriceHT = variantPriceTTC / (1 + finalTaxRate / 100)
          variantPrice = variantPriceTTC
        } else if (parsed.price !== undefined && parsed.price !== null && parsed.price !== '') {
          variantPrice = parseFloat(parsed.price)
          variantPriceTTC = variantPrice
          variantPriceHT = variantPrice / (1 + finalTaxRate / 100)
        }

        return {
          productId: id,
          variantTypeId: parsed.variantTypeId || null,
          variantValueId: parsed.variantValueId || null,
          type: parsed.type || parsed.variantTypeName || 'taille',
          value: parsed.value || '',
          priceHT: variantPriceHT,
          priceTTC: variantPriceTTC,
          priceAdjustment: 0,
          stock: parseInt(parsed.stock || 0) || 0,
          image: parsed.image && parsed.image !== '' ? parsed.image : null,
          description: parsed.description || null,
          barcode: (parsed.barcode && parsed.barcode !== '' && parsed.barcode !== 'null') ? parsed.barcode : null,
          expiryDate: parsed.expiryDate && parsed.expiryDate !== '' && parsed.expiryDate !== 'null' ? (() => { try { return new Date(parsed.expiryDate).toISOString() } catch { return null } })() : null,
          active: parsed.active !== false
        }
      })

      function parseVariantString(v) {
        const result = {}
        if (!v || !v.value) return result
        
        // Format: type:value:price:stock:image:barcode:expiryDate | type:value:price:stock:image:barcode:expiryDate
        const parts = v.value.split('|')
        parts.forEach(part => {
          part = part.trim()
          if (!part) return
          
          // Extraire type et valeur (ex: "volume:50ml")
          const match = part.match(/^([^:]+):(.+)$/)
          if (match) {
            const [, type, value] = match
            result.type = type.trim()
            result.value = value.trim()
          }
          
          // Extraire les autres champs par position
          const fields = part.split(':').filter(f => f.trim())
          if (fields.length >= 2) {
            result.variantTypeId = fields[0] || null
            result.variantValueId = fields[1] || null
            if (fields[2]) result.price = fields[2]
            if (fields[3]) result.stock = fields[3]
            if (fields[4] && fields[4].trim() !== '') result.image = fields[4].trim()
            if (fields[5] && fields[5].trim() !== '') result.barcode = fields[5].trim()
            if (fields[6] && fields[6].trim() !== '') result.expiryDate = fields[6].trim()
          }
        })
        
        return result
      }
          await prisma.productVariant.createMany({
            data: variantsToCreate
          })
        }
      }
    }
    
    // Fetch updated product with variants
    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brandModel: true,
            productVariants: {
              include: {
                variantType: true,
                variantValue: true
              }
            }
      }
    })
    
    // Invalidate cache after update
    await invalidateProductCache();
    
    res.json(updatedProduct)
  } catch (error) {
    console.error('=== ERREUR PUT PRODUCT ===')
    console.error('Route: PUT /:id')
    console.error('Product ID:', req.params.id)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Error meta:', JSON.stringify(error.meta))
    console.error('Stack:', error.stack)
    res.status(500).json({ message: 'Erreur serveur', error: error.message, code: error.code, meta: error.meta })
  }
})

// POST - Créer une variante pour un produit
router.post('/:id/variants', async (req, res) => {
  try {
    const { id } = req.params
    const { variantTypeId, variantValueId, type, value, price, priceHT, priceTTC, stock, image, description } = req.body

    // Get product tax rate for calculations
    const product = await prisma.product.findUnique({ where: { id } })
    const taxRate = product?.taxRate || 20

    // Handle price calculations
    let finalPrice = null
    let finalPriceHT = null
    let finalPriceTTC = null

    if (priceHT !== undefined && priceHT !== null) {
      finalPriceHT = parseFloat(priceHT)
      finalPriceTTC = finalPriceHT * (1 + taxRate / 100)
      finalPrice = finalPriceTTC
    } else if (priceTTC !== undefined && priceTTC !== null) {
      finalPriceTTC = parseFloat(priceTTC)
      finalPriceHT = finalPriceTTC / (1 + taxRate / 100)
      finalPrice = finalPriceTTC
    } else if (price !== undefined && price !== null) {
      finalPrice = parseFloat(price)
      finalPriceTTC = finalPrice
      finalPriceHT = finalPrice / (1 + taxRate / 100)
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        variantTypeId: variantTypeId || null,
        variantValueId: variantValueId || null,
        type: type || 'taille',
        value: value || '',
        price: finalPrice,
        priceHT: finalPriceHT,
        priceTTC: finalPriceTTC,
        priceAdjustment: 0,
        stock: parseInt(stock) || 0,
        image: image || null,
        description: description || null
      }
    })

    res.status(201).json(variant)
  } catch (error) {
    console.error('Erreur création variante:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// PUT - Mettre à jour une variante
router.put('/:productId/variants/:variantId', async (req, res) => {
  try {
    const { productId, variantId } = req.params
    const { variantTypeId, variantValueId, type, value, price, priceHT, priceTTC, stock, image, description, active } = req.body

    // Get product tax rate for calculations
    const product = await prisma.product.findUnique({ where: { id: productId } })
    const taxRate = product?.taxRate || 20

    // Handle price calculations
    let finalPrice = undefined
    let finalPriceHT = undefined
    let finalPriceTTC = undefined

    if (priceHT !== undefined) {
      finalPriceHT = priceHT ? parseFloat(priceHT) : null
      finalPriceTTC = finalPriceHT ? finalPriceHT * (1 + taxRate / 100) : null
      finalPrice = finalPriceTTC
    } else if (priceTTC !== undefined) {
      finalPriceTTC = priceTTC ? parseFloat(priceTTC) : null
      finalPriceHT = finalPriceTTC ? finalPriceTTC / (1 + taxRate / 100) : null
      finalPrice = finalPriceTTC
    } else if (price !== undefined) {
      finalPrice = price ? parseFloat(price) : null
      finalPriceTTC = finalPrice
      finalPriceHT = finalPrice ? finalPrice / (1 + taxRate / 100) : null
    }

    const variant = await prisma.productVariant.update({
      where: { id: variantId, productId },
      data: {
        variantTypeId: variantTypeId || null,
        variantValueId: variantValueId || null,
        type: type || undefined,
        value: value || undefined,
        price: finalPrice,
        priceHT: finalPriceHT,
        priceTTC: finalPriceTTC,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        image: image || undefined,
        description: description || undefined,
        active: active !== undefined ? active : undefined
      }
    })

    res.json(variant)
  } catch (error) {
    console.error('Erreur mise à jour variante:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// DELETE - Supprimer une variante
router.delete('/:productId/variants/:variantId', async (req, res) => {
  try {
    const { productId, variantId } = req.params
    
    // First delete associated stock movements
    await prisma.stockMovement.deleteMany({
      where: { variantId }
    })
    
    await prisma.productVariant.delete({
      where: { id: variantId, productId }
    })
    
    res.json({ message: 'Variante supprimée avec succès' })
  } catch (error) {
    console.error('Erreur suppression variante:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// POST - S'inscrire pour notification de retour en stock
router.post('/:productId/stock-notification', async (req, res) => {
  try {
    const { productId } = req.params
    const { email } = req.body
    
    // Verify product exists and is out of stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true }
    })
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' })
    }
    
    if (product.stock > 0) {
      return res.status(400).json({ message: 'Ce produit est déjà en stock' })
    }
    
    // Check if already subscribed
    const existing = await prisma.stockNotification.findFirst({
      where: {
        productId,
        email: email?.toLowerCase(),
        notified: false
      }
    })
    
    if (existing) {
      return res.status(400).json({ message: 'Vous êtes déjà inscrit pour ce produit' })
    }
    
    // Create notification subscription
    const notification = await prisma.stockNotification.create({
      data: {
        productId,
        email: email?.toLowerCase() || '',
        userId: req.userId || null
      }
    })
    
    res.status(201).json({ message: 'Inscription réussie ! Vous serez notifié lorsque le produit sera de nouveau en stock.', notification })
  } catch (error) {
    console.error('Erreur inscription notification stock:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// GET - Vérifier si un produit est en stock (pour les notifications)
router.get('/:productId/stock-status', async (req, res) => {
  try {
    const { productId } = req.params
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true, stockAlert: true }
    })
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' })
    }
    
    res.json({
      productId: product.id,
      name: product.name,
      inStock: product.stock > 0,
      stock: product.stock,
      lowStock: product.stock > 0 && product.stock <= product.stockAlert
    })
  } catch (error) {
    console.error('Erreur vérification stock:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})
// backend/src/routes/products.js
// REMPLACEZ la route DELETE par celle-ci :

// DELETE - Supprimer un produit (admin seulement)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    console.log('🔍 Tentative de suppression du produit:', id)
    
    // Vérifier si le produit existe
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
        favorites: true,
        productImages: true,
        productVariants: true,
        stockMovements: true
      }
    })
    
    if (!product) {
      console.log('❌ Produit non trouvé:', id)
      return res.status(404).json({ message: 'Produit non trouvé' })
    }
    
    console.log('✅ Produit trouvé:', product.name)
    console.log(`📊 Relations trouvées: 
      - orderItems: ${product.orderItems.length}
      - favorites: ${product.favorites.length}
      - productImages: ${product.productImages.length}
      - productVariants: ${product.productVariants.length}
      - stockMovements: ${product.stockMovements.length}`)
    
    // 1. Supprimer les OrderItems
    if (product.orderItems.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { productId: id }
      })
      console.log('✅ OrderItems supprimés')
    }
    
    // 2. Supprimer les Favorites
    if (product.favorites.length > 0) {
      await prisma.favorite.deleteMany({
        where: { productId: id }
      })
      console.log('✅ Favoris supprimés')
    }
    
    // 3. Supprimer les ProductImages
    if (product.productImages.length > 0) {
      await prisma.productImage.deleteMany({
        where: { productId: id }
      })
      console.log('✅ ProductImages supprimés')
    }
    
    // 4. Supprimer les ProductVariants et leurs StockMovements associés
    if (product.productVariants.length > 0) {
      for (const variant of product.productVariants) {
        // Supprimer les stockMovements liés à ce variant
        await prisma.stockMovement.deleteMany({
          where: { variantId: variant.id }
        })
      }
      await prisma.productVariant.deleteMany({
        where: { productId: id }
      })
      console.log('✅ ProductVariants supprimés')
    }
    
    // 5. Supprimer les StockMovements directs (sans variant)
    if (product.stockMovements.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { productId: id }
      })
      console.log('✅ StockMovements supprimés')
    }
    
    // 6. Enfin, supprimer le produit
    await prisma.product.delete({
      where: { id }
    })
    
    // Invalidate cache after delete
    await invalidateProductCache();
    
    console.log('✅ Produit supprimé avec succès')
    res.json({ message: 'Produit supprimé avec succès' })
    
  } catch (error) {
    console.error('❌ Erreur suppression produit:', error)
    
    // Afficher plus de détails sur l'erreur
    if (error.code === 'P2003') {
      console.log('⚠️ Contrainte de clé étrangère violée')
      console.log('   Table concernée:', error.meta?.field_name || 'inconnue')
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression du produit', 
      error: error.message,
      code: error.code
    })
  }
})

// PATCH - Mettre à jour le stock (with stock notification trigger)
router.patch('/:id/stock', async (req, res) => {
  try {
    const { id } = req.params
    const { quantity, type, reason } = req.body
    
    const oldProduct = await prisma.product.findUnique({
      where: { id }
    })
    
    const product = await prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: type === 'add' ? quantity : -quantity
        }
      }
    })
    
    await prisma.stockMovement.create({
      data: {
        productId: id,
        type: type === 'add' ? 'ADD' : 'REMOVE',
        quantity,
        reason,
        userId: req.userId
      }
    })
    
    // Trigger WebSocket if stock goes from 0 → >0
    if (oldProduct.stock === 0 && product.stock > 0) {
      io.to('admin_room').emit('admin_stock_restocked', {
        productId: product.id,
        productName: product.name,
        oldStock: 0,
        newStock: product.stock
      })
    }
    
    res.json(product)
  } catch (error) {
    console.error('Erreur mise à jour stock:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// POST - Import products from CSV/Excel
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    console.log('Import endpoint called')
    console.log('File:', req.file)
    console.log('Body:', req.body)
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni' })
    }
    
    const file = req.file
    const results = { success: 0, errors: [], products: [] }
    
    // Parse file based on extension
    const fileName = file.originalname.toLowerCase()
    let rows = []
    let headers = []
    
    try {
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel file
        const workbook = XLSX.read(file.buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        
        if (allRows.length > 0) {
          // Get headers from first row
          headers = allRows[0].map(h => String(h || '').trim().toLowerCase())
          
          // Filter out empty rows (skip rows where all cells are empty)
          rows = allRows.slice(1).filter(row => {
            return row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          })
        }
      } else {
        // CSV file - read as text
        const content = file.buffer.toString('utf-8')
        const lines = content.split(/\r?\n/).filter(line => line.trim())
        if (lines.length > 0) {
          headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/\r/g, ''))
          rows = lines.slice(1)
        }
      }
    } catch (parseError) {
      console.error('Parse error:', parseError)
      return res.status(400).json({ success: false, message: 'Erreur lecture fichier: ' + parseError.message })
    }
    
    if (headers.length === 0) {
      return res.status(400).json({ success: false, message: 'Fichier vide ou invalide' })
    }
    
    console.log('Import headers:', headers)
    
    // Check if we have at least name and price
    const hasName = headers.includes('name')
    const hasPrice = headers.includes('price') || headers.includes('priceht')
    if (!hasName || !hasPrice) {
      return res.status(400).json({ success: false, message: `Headers manquants: name, price. Reçus: ${headers.join(', ')}` })
    }
    
    // Process each row
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i]
        const productData = {}
        
        // Debug: log raw row data for first few rows
        if (i < 2) {
          console.log(`Row ${i + 1} raw:`, JSON.stringify(row))
        }
        
        // Handle both array (Excel) and string (CSV) rows
        if (Array.isArray(row)) {
          headers.forEach((header, index) => {
            const value = row[index]
            if (value === undefined || value === null) return
            const strValue = String(value).trim()
            if (strValue === '') return
            
            switch (header) {
              case 'name': productData.name = strValue; break;
              case 'price': case 'prix': case 'priceht': productData.priceHT = parseFloat(strValue) || 0; break;
              case 'oldprice': case 'oldpriceht': case 'anciens prix': productData.oldPriceHT = strValue ? parseFloat(strValue) : null; break;
              case 'taxrate': productData.taxRate = parseFloat(strValue) || 20; break;
              case 'stock': productData.stock = parseInt(strValue) || 0; break;
              case 'stockalert': case 'alert stock': case 'alerte stock': productData.stockAlert = parseInt(strValue) || 10; break;
              case 'description': case 'desc': productData.description = strValue; break;
              case 'brand': case 'marque': productData.brand = strValue; break;
              case 'barcode': case 'code barres': case 'codebarres': 
                let cleanBarcode = strValue.replace(/\.(jpg|png|jpeg|gif|webp)$/i, '').trim()
                cleanBarcode = cleanBarcode.replace(/^(https?:)?\/\//i, '').split('/')[0]
                productData.barcode = cleanBarcode || null; break;
              case 'category': case 'categorie': productData.category = strValue; break;
              case 'subcategory': case 'sous categorie': productData.subcategory = strValue; break;
              case 'subcategoryitem': case 'item': case 'sous categorie item': productData.subcategoryItem = strValue; break;
              case 'image': case 'url image': case 'imageurl': case 'img': productData.image = strValue ? strValue.trim() : null; break;
              case 'active': productData.active = strValue.toLowerCase() !== 'false'; break;
              case 'expirydate': case 'date expiration': productData.expiryDate = strValue || null; break;
              case 'variants': case 'variant': productData.variants = strValue; break;
              default:
                // Keep any column starting with "variant_" for later processing
                if (header.startsWith('variant_')) {
                  productData[header] = strValue
                }
                break;
            }
          })
        } else {
          // CSV string row
          console.log('=== DEBUG IMPORT ===')
          console.log('Headers:', headers)
          console.log('Row:', row)
          const commaCount = row.split(',').length
          const semicolonCount = row.split(';').length
          const delimiter = commaCount >= semicolonCount ? ',' : ';'
          const values = row.split(delimiter).map(v => v.trim().replace(/\r/g, ''))
          
          console.log('Values:', values)
          
          headers.forEach((header, index) => {
            const value = values[index] || ''
            switch (header) {
              case 'name': productData.name = value; break;
              case 'price': case 'prix': case 'priceht': productData.priceHT = parseFloat(value) || 0; break;
              case 'oldprice': case 'oldpriceht': case 'anciens prix': productData.oldPriceHT = value ? parseFloat(value) : null; break;
              case 'taxrate': productData.taxRate = parseFloat(value) || 20; break;
              case 'stock': productData.stock = parseInt(value) || 0; break;
              case 'stockalert': case 'alert stock': case 'alerte stock': productData.stockAlert = parseInt(value) || 10; break;
              case 'description': case 'desc': productData.description = value; break;
              case 'brand': case 'marque': productData.brand = value; break;
              case 'barcode': case 'code barres': case 'codebarres': 
                let cleanBarcode = value.replace(/\.(jpg|png|jpeg|gif|webp)$/i, '').trim()
                cleanBarcode = cleanBarcode.replace(/^(https?:)?\/\//i, '').split('/')[0]
                productData.barcode = cleanBarcode || null; break;
              case 'category': case 'categorie': productData.category = value; break;
              case 'subcategory': case 'sous categorie': productData.subcategory = value; break;
              case 'subcategoryitem': case 'item': case 'sous categorie item': productData.subcategoryItem = value; break;
              case 'image': case 'url image': case 'imageurl': case 'img': productData.image = value ? value.trim() : null; break;
              case 'active': productData.active = value.toLowerCase() !== 'false'; break;
              case 'expirydate': case 'date expiration': productData.expiryDate = value || null; break;
              case 'variants': case 'variant': productData.variants = value; break;
              default:
                // Keep any column starting with "variant_" for later processing
                if (header.startsWith('variant_')) {
                  productData[header] = value
                }
                break;
            }
          })
        }
        
        console.log('productData:', productData)
        
        if (!productData.name) {
          results.errors.push(`Ligne ${i + 1}: nom manquant`)
          continue
        }

        // Find category - use flexible matching
        if (productData.category) {
          const categories = await prisma.category.findMany()
          let matched = null
          const searchQuery = productData.category.toLowerCase().trim()
          
          // First try exact match (case-insensitive)
          matched = categories.find(c => c.name.toLowerCase() === searchQuery)
          
          // Then try contains match
          if (!matched) {
            matched = categories.find(c => 
              c.name.toLowerCase().includes(searchQuery) ||
              searchQuery.includes(c.name.toLowerCase())
            )
          }
          
          // Then try partial word match (for categories like "Cosmétique & soins" -> "Cosmétique")
          if (!matched) {
            const keywords = searchQuery.split(/[&\s]+/).filter(w => w.length > 2)
            matched = categories.find(c => {
              const catWords = c.name.toLowerCase().split(/[&\s]+/)
              return keywords.some(kw => catWords.some(cw => cw.includes(kw) || kw.includes(cw)))
            })
          }
          
          if (matched) {
            productData.categoryId = matched.id
          } else {
            // Warning but don't fail - use default category
            results.errors.push(`Ligne ${i + 1}: catégorie "${productData.category}" non trouvée`)
          }
        }
        
        // Find subcategory if provided
        if (productData.subcategory && productData.categoryId) {
          const subcategory = await prisma.subcategory.findFirst({
            where: { 
              title: { contains: productData.subcategory, mode: 'insensitive' },
              categoryId: productData.categoryId
            }
          })
          if (subcategory) {
            productData.subcategoryId = subcategory.id
          }
        }
        
        // Find subcategory item if provided
        if (productData.subcategoryItem && productData.subcategoryId) {
          const subcategoryItem = await prisma.subcategoryItem.findFirst({
            where: { 
              name: { contains: productData.subcategoryItem, mode: 'insensitive' },
              subcategoryId: productData.subcategoryId
            }
          })
          if (subcategoryItem) {
            productData.subcategoryItemId = subcategoryItem.id
          }
        }
        
        // Get default category if none found
        if (!productData.categoryId) {
          const defaultCategory = await prisma.category.findFirst()
          if (defaultCategory) {
            productData.categoryId = defaultCategory.id
          } else {
            results.errors.push(`Ligne ${i + 1}: aucune catégorie disponible`)
            continue
          }
        }
        
        // Parse expiry date if provided - handle various date formats
        let expiryDate = null
        if (productData.expiryDate) {
          try {
            let dateStr = String(productData.expiryDate).trim()
            
            // Check if it's a number (Excel date format - days since 1900)
            if (/^\d+(\.\d+)?$/.test(dateStr)) {
              const excelDate = parseFloat(dateStr)
              // Excel epoch is December 30, 1899
              const excelEpoch = new Date(1899, 11, 30)
              const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000)
              if (!isNaN(jsDate.getTime())) {
                expiryDate = jsDate.toISOString()
              }
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
              // Already ISO string
              const test = new Date(dateStr)
              if (!isNaN(test.getTime())) {
                expiryDate = dateStr
              }
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              // Date only (YYYY-MM-DD)
              const [year, month, day] = dateStr.split('-').map(Number)
              const jsDate = new Date(year, month - 1, day, 12, 0, 0)
              if (!isNaN(jsDate.getTime())) {
                expiryDate = jsDate.toISOString()
              }
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
              // French format: DD/MM/YYYY
              const parts = dateStr.split('/')
              const day = parseInt(parts[0])
              const month = parseInt(parts[1])
              const year = parseInt(parts[2])
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const jsDate = new Date(year, month - 1, day, 12, 0, 0)
                if (!isNaN(jsDate.getTime())) {
                  expiryDate = jsDate.toISOString()
                }
              }
            } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
              // French format with dashes: DD-MM-YYYY
              const parts = dateStr.split('-')
              const day = parseInt(parts[0])
              const month = parseInt(parts[1])
              const year = parseInt(parts[2])
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const jsDate = new Date(year, month - 1, day, 12, 0, 0)
                if (!isNaN(jsDate.getTime())) {
                  expiryDate = jsDate.toISOString()
                }
              }
            } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
              // US format: YYYY/MM/DD
              const parts = dateStr.split('/')
              const year = parseInt(parts[0])
              const month = parseInt(parts[1])
              const day = parseInt(parts[2])
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const jsDate = new Date(year, month - 1, day, 12, 0, 0)
                if (!isNaN(jsDate.getTime())) {
                  expiryDate = jsDate.toISOString()
                }
              }
            } else {
              // Try generic parsing
              const jsDate = new Date(dateStr)
              if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 2000 && jsDate.getFullYear() <= 2100) {
                expiryDate = jsDate.toISOString()
              }
            }
          } catch (e) { 
            console.warn(`Warning: Could not parse expiry date "${productData.expiryDate}", setting to null`, e.message)
            expiryDate = null 
          }
        }
        
        // Create product
        const taxRate = productData.taxRate || 20
        const priceHT = productData.priceHT || 0
        const priceTTC = priceHT * (1 + taxRate / 100)
        const oldPriceHT = productData.oldPriceHT || null
        const oldPriceTTC = oldPriceHT ? oldPriceHT * (1 + taxRate / 100) : null
        
        // Debug log for first row
        if (i < 2) {
          console.log(`Row ${i + 1} productData:`, productData)
          console.log(`Row ${i + 1} create data:`, {
            name: productData.name,
            priceHT, priceTTC, taxRate,
            categoryId: productData.categoryId,
            expiryDate
          })
        }

        // Check for existing product by barcode (if barcode provided)
        let existingProduct = null
        if (productData.barcode) {
          existingProduct = await prisma.product.findFirst({
            where: { barcode: productData.barcode }
          })
          if (existingProduct) {
            results.errors.push(`Ligne ${i + 1}: barcode "${productData.barcode}" existe déjà pour le produit "${existingProduct.name}"`)
            continue
          }
        }

         // Check for existing product by name + categoryId
         existingProduct = await prisma.product.findFirst({
           where: { 
             name: productData.name,
             categoryId: productData.categoryId
           }
         })
         if (existingProduct) {
           results.errors.push(`Ligne ${i + 1}: le produit "${productData.name}" existe déjà dans cette catégorie`)
           continue
         }
         
          // Extract variant data from productData (colonnes variant_*)
          const variantRows = []
          Object.keys(productData).forEach(key => {
            const match = key.match(/^variant_(\d+)_(.+)$/)
            if (match) {
              const index = match[1]
              const field = match[2]
              if (!variantRows[index]) variantRows[index] = {}
              variantRows[index][field] = productData[key]
            }
          })
          // Remove variant fields from productData to avoid saving as product fields
          Object.keys(productData).forEach(key => {
            if (/^variant_\d+_/.test(key)) {
              delete productData[key]
            }
          })
          
          let variantsData = variantRows.filter(v => v && (v.type || v.value))
          
          // Also support a 'variants' column as string (format: "type:value:stock:price:image|type:value:stock:price:image")
          if (productData.variants) {
            const variantsStr = String(productData.variants).trim()
            if (variantsStr) {
              try {
                // Try JSON first
                const jsonVariants = JSON.parse(variantsStr)
                if (Array.isArray(jsonVariants)) {
                  variantsData = [...variantsData, ...jsonVariants]
                }
              } catch (e) {
                // Fallback: pipe-separated format "type:value:stock:price:image:barcode:expiryDate"
                // Problème: URL contains ":" so we parse from right to left
                const pipeParts = variantsStr.split('|').filter(p => p.trim())
                console.log('=== VARIANT DEBUG ===')
                console.log('variantsStr:', variantsStr)
                console.log('pipeParts:', pipeParts)
                pipeParts.forEach((part, idx) => {
                  // First, extract type and value (first two fields separated by ":")
                  const firstColon = part.indexOf(':')
                  if (firstColon === -1) return
                  
                  const type = part.substring(0, firstColon).trim()
                  let remaining = part.substring(firstColon + 1)
                  
                  // Extract value (may contain ":" but we assume it doesn't, or we find second colon)
                  const secondColon = remaining.indexOf(':')
                  if (secondColon === -1) {
                    // Only type:value
                    variantsData.push({ type: type || 'variante', value: remaining.trim() || '' })
                    return
                  }
                  
                  const value = remaining.substring(0, secondColon).trim()
                  remaining = remaining.substring(secondColon + 1)
                  
                  // Now remaining = "stock:price:image:barcode:expiryDate"
                  // We'll split by ":" but then rebuild correctly
                  const fields = remaining.split(':').map(f => f.trim())
                  
                  // We know the last two fields are barcode and expiryDate (if they exist)
                  // and the first two fields are stock and price
                  let stock, price, image, barcode, expiryDate
                  
                  if (fields.length >= 1) stock = parseInt(fields[0]) || 0
                  if (fields.length >= 2) price = parseFloat(fields[1]) || undefined
                  
                  // Image is everything from index 2 to index (length-2), joined by ":"
                  // because last two fields are barcode and expiryDate
                  if (fields.length >= 3) {
                    // Check if we have barcode and expiryDate (at least 5 fields total: stock, price, image..., barcode, expiryDate)
                    if (fields.length >= 5) {
                      // Last two are barcode and expiryDate
                      barcode = fields[fields.length - 2] || undefined
                      expiryDate = fields[fields.length - 1] || undefined
                      // Image is everything from index 2 to index before barcode
                      image = fields.slice(2, fields.length - 2).join(':') || undefined
                    } else {
                      // Only 3 or 4 fields: stock, price, image(, maybe barcode)
                      // Assume if 4 fields: stock, price, image, barcode
                      if (fields.length === 4) {
                        barcode = fields[3] || undefined
                        image = fields[2] || undefined
                      } else {
                        // 3 fields: stock, price, image
                        image = fields[2] || undefined
                      }
                    }
                  }
                  
                  console.log(`Part ${idx}: type=${type}, value=${value}, stock=${stock}, price=${price}, image=${image}, barcode=${barcode}, expiryDate=${expiryDate}`)
                  
                   variantsData.push({
                     type: type || 'variante',
                     value: value || '',
                     stock: stock,
                     price: price,
                     priceHT: price,
                     image: image || undefined,
                     barcode: barcode || undefined,
                     expiryDate: expiryDate || undefined
                   })
                })
              }
            }
            delete productData.variants
          }
        
        // Gérer la marque automatiquement
        let finalBrandId = null;
        if (productData.brand) {
          // Chercher si la marque existe
          let brandModel = await prisma.brand.findUnique({
            where: { name: productData.brand.trim() }
          });
          
          if (!brandModel) {
            // Créer la marque automatiquement
            brandModel = await prisma.brand.create({
              data: {
                name: productData.brand.trim(),
                active: true
              }
            });
          }
          
          finalBrandId = brandModel.id;
        }
        
         const product = await prisma.product.create({
           data: {
             name: productData.name,
             price: priceTTC,
             priceHT: priceHT,
             priceTTC: priceTTC,
             oldPrice: oldPriceTTC,
             oldPriceHT: oldPriceHT,
             taxRate: taxRate,
             stock: productData.stock || 0,
             stockAlert: productData.stockAlert || 10,
             description: productData.description,
             brand: productData.brand,
             brandId: finalBrandId,
             barcode: productData.barcode,
             image: productData.image,
             categoryId: productData.categoryId,
             subcategoryId: productData.subcategoryId || null,
             subcategoryItemId: productData.subcategoryItemId || null,
active: productData.active !== false,
              expiryDate: expiryDate
            }
          })
          
          console.log('Created product:', { 
            name: product.name, 
            barcode: product.barcode, 
            image: product.image, 
            expiryDate: product.expiryDate 
          })
          
          // Create variants if provided (atomic: delete product if variant creation fails)
          if (variantsData && variantsData.length > 0) {
            try {
              const taxRate = productData.taxRate || 20
              const variantsToCreate = variantsData.map(v => {
                // Parse expiry date if provided - handle French format DD/MM/YYYY
                let variantExpiry = null
                if (v.expiryDate) {
                  try {
                    const dateStr = String(v.expiryDate).trim()
                    let d = null
                    
                    // French format: DD/MM/YYYY
                    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                      const parts = dateStr.split('/')
                      d = new Date(parts[2], parts[1] - 1, parts[0])
                    }
                    // French format with dashes: DD-MM-YYYY
                    else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
                      const parts = dateStr.split('-')
                      d = new Date(parts[2], parts[1] - 1, parts[0])
                    }
                    // US format: YYYY/MM/DD
                    else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                      const parts = dateStr.split('/')
                      d = new Date(parts[0], parts[1] - 1, parts[2])
                    }
                    else {
                      d = new Date(dateStr)
                    }
                    
                    if (d && !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
                      variantExpiry = d.toISOString()
                    }
                  } catch (e) { variantExpiry = null }
                }
                // Handle price: support priceHT and priceTTC, or legacy price field
                let variantPrice = null
                let variantPriceHT = null
                let variantPriceTTC = null

                if (v.priceHT !== undefined && v.priceHT !== '') {
                  variantPriceHT = parseFloat(v.priceHT)
                  variantPriceTTC = variantPriceHT * (1 + taxRate / 100)
                  variantPrice = variantPriceTTC // Keep price field for backward compatibility
                } else if (v.priceTTC !== undefined && v.priceTTC !== '') {
                  variantPriceTTC = parseFloat(v.priceTTC)
                  variantPriceHT = variantPriceTTC / (1 + taxRate / 100)
                  variantPrice = variantPriceTTC // Keep price field for backward compatibility
                } else if (v.price !== undefined && v.price !== '') {
                  variantPrice = parseFloat(v.price)
                  // For legacy price, assume it's TTC and calculate HT
                  variantPriceTTC = variantPrice
                  variantPriceHT = variantPrice / (1 + taxRate / 100)
                }

                return {
                  productId: product.id,
                  variantTypeId: v.variantTypeId || null,
                  variantValueId: v.variantValueId || null,
                  type: v.type || 'variante',
                  value: v.value || '',
                  priceHT: variantPriceHT,
                  priceTTC: variantPriceTTC,
                  priceAdjustment: 0,
                  stock: parseInt(v.stock) || 0,
        image: v.image && v.image !== '' ? v.image : null,
                  description: v.description || null,
        barcode: v.barcode && v.barcode !== '' ? v.barcode : null,
                  expiryDate: variantExpiry,
                  active: v.active === undefined || v.active === null ? true : String(v.active).toLowerCase() !== 'false'
                }
              })
              await prisma.productVariant.createMany({
                data: variantsToCreate
              })
              console.log('Created variants:', variantsToCreate.map(v => ({ type: v.type, value: v.value, barcode: v.barcode, expiryDate: v.expiryDate, image: v.image })))
            } catch (variantError) {
              await prisma.product.delete({ where: { id: product.id } })
              throw variantError // Will be caught by outer catch and reported as row error
            }
}
          
          results.success++
          results.products.push(product)
          results.imported = (results.imported || 0) + 1
        } catch (rowError) {
          results.errors.push(`Ligne ${i + 1}: ${rowError.message}`)
          results.errorDetails = results.errorDetails || []
          results.errorDetails.push({ row: i + 1, error: rowError.message })
        }
}
    
await invalidateProductCache()
    
    // Fetch the created products with variants to return
    const productsWithVariants = await prisma.product.findMany({
      where: { 
        id: { in: results.products.map(p => p.id) }
      },
      include: {
        productVariants: true
      }
    })
    
    res.json({
      ...results,
      success: results.success > 0 || results.imported > 0,
      imported: results.imported || results.success,
      products: productsWithVariants
    })
  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message })
  }
})

export default router