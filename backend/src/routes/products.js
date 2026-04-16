// backend/src/routes/products.js
import express from 'express'
import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const prisma = new PrismaClient()

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

  if (!nameMatch.match && !brandMatch.match && !catMatch.match) return 0

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

  return score
}

// Helper: Download image from URL and return filename
async function downloadProductImage(url) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })

    const uploadsDir = path.join(process.cwd(), 'uploads', 'products')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const filename = `product-${Date.now()}-${uuidv4().slice(0, 8)}.jpg`
    const filePath = path.join(uploadsDir, filename)
    const writer = fs.createWriteStream(filePath)

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filename))
      writer.on('error', reject)
    })
  } catch (error) {
    console.error('Error downloading image:', error)
    return null
  }
}

// POST /products/scan-barcode - Lookup product by barcode
router.post('/scan-barcode', async (req, res) => {
  try {
    // 1. Fetch local categories for matching
    const localCategories = await prisma.category.findMany({ select: { id: true, name: true } })

    // 2. Try Open Beauty Facts
    let apiUrl = `https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`
    let response = await axios.get(apiUrl)
    let productData = response.data

    if (!productData || productData.status === 0) {
      // 3. Fallback to Open Food Facts
      apiUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      response = await axios.get(apiUrl)
      productData = response.data
    }

    if (!productData || productData.status === 0) {
      return res.status(404).json({ message: 'Produit non trouvé dans les bases de données publiques' })
    }

    const p = productData.product
    
    // Improved Image Selection
    const imageToDownload = p.image_front_url || p.image_url || p.image_small_url
    let imageUrl = null
    let localImage = null
    if (imageToDownload) {
      localImage = await downloadProductImage(imageToDownload)
      if (localImage) {
        const protocol = req.protocol
        const host = req.get('host')
        imageUrl = `${protocol}://${host}/uploads/products/${localImage}`
      }
    }

    // Category Matching Logic
    let suggestedCategoryId = null
    const tags = [
      ...(p.categories_tags || []),
      ...(p.categories_hierarchy || []),
      p.main_category,
      p.category_properties?.['en:category_main_tag']
    ].filter(Boolean).map(t => t.toLowerCase())

    const catMapping = {
      '5a75c434-5851-4206-84d9-312624932f96': ['cosmetic', 'beauty', 'skin', 'face', 'soin', 'creme', 'makeup', 'maquillage'], // Cosmétiques & Soin
      'f048bc99-ab70-4c16-8b8a-d70840ed61d5': ['hygiene', 'bath', 'shower', 'soap', 'shampoo', 'corps', 'body', 'deodorant'], // Hygiène & Corps
      'c7e55e8c-cc5c-43be-88d4-234694a1d8eb': ['baby', 'bebe', 'maternity', 'maternite', 'infant', 'diaper', 'couche'], // Bébé & Maternité
      '3b78d5b5-b4a1-4f78-a2ec-24b050671051': ['sun', 'solaire', 'protection', 'uv', 'screen'], // Solaire & Protection
      'ab6770bc-df17-44be-83a2-9edfb7faf207': ['supplement', 'pill', 'vitamin', 'complements', 'health', 'sante'], // Complémentaires
      '15790b7e-6da5-4110-9bf6-adcaa6eab728': ['orthopedic', 'orthopedique', 'joint', 'bandage', 'brace'] // Orthopédique
    }

    for (const [catId, keywords] of Object.entries(catMapping)) {
      if (tags.some(tag => keywords.some(kw => tag.includes(kw)))) {
        suggestedCategoryId = catId
        break
      }
    }

    // Fallback brand extraction
    const brandName = p.brands || p.brands_tags?.[0] || ''

    res.json({
      name: p.product_name || p.product_name_fr || '',
      brand: brandName.replace(/,/g, ', '),
      description: p.generic_name || p.description || p.product_name || '',
      image: imageUrl,
      imageFilename: localImage,
      barcode: barcode,
      price: null,
      stock: 1,
      categoryId: suggestedCategoryId,
      isSuggested: !!suggestedCategoryId,
      composition: p.ingredients_text || '',
      usage: p.instructions || ''
    })

  } catch (error) {
    console.error('Scan error:', error)
    res.status(500).json({ message: 'Erreur lors du scan intelligent' })
  }
})

// GET /products/search - Accent-insensitive suggestions
router.get('/search', async (req, res) => {
  try {
    const { q = '', limit = 8 } = req.query
    const query = q.trim()
    if (query.length < 1) return res.json([])

    // Fetch all active products, filter entirely in JS so accent
    // normalization works regardless of DB collation.
    // (Pharmacy catalogs are small enough for this to be fast.)
    const all = await prisma.product.findMany({
      where: {
        active: true,
        NOT: { category: { name: 'Promotions' } }
      },
      select: {
        id: true, name: true, brand: true, price: true, oldPrice: true,
        image: true, stock: true,
        category: { select: { name: true } }
      }
    })

    const results = all
      .map(p => ({ ...p, _score: scoreProduct(query, p) }))
      .filter(p => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, parseInt(limit))
      .map(({ _score, ...p }) => p)

    res.json(results)
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json([])
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
      search,
      page = 1,
      limit = 12,
      active,
      outOfStock
    } = req.query

    const where = {}
    
    // Only filter by active=true for public API (when active param is not provided)
    if (active !== undefined) {
      where.active = active === 'true'
    } else {
      where.active = true
    }

    // Exclure la catégorie "Promotions" des listes publiques
    const promoCategory = await prisma.category.findFirst({ where: { name: 'Promotions' } })
    if (promoCategory) {
      where.NOT = { categoryId: promoCategory.id }
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
      // Accent-insensitive filtering is done in JS below.
      // Set a broad OR so Prisma doesn't restrict candidates too early.
      const sNorm = normalize(search)
      const prefix = sNorm.slice(0, 3)
      where.OR = [
        { name:  { contains: prefix, mode: 'insensitive' } },
        { brand: { contains: prefix, mode: 'insensitive' } },
        { description: { contains: prefix, mode: 'insensitive' } },
        { name:  { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch and paginate
    let products, total

    if (search) {
      const sNorm = normalize(search)
      // Fetch ALL active products (ignoring the prefix OR) so JS can
      // do proper accent-insensitive filtering on the full dataset.
      const allActive = await prisma.product.findMany({
        where: { active: true, ...(category ? { category: where.category } : {}), ...(subcategory ? { subcategoryItemId: where.subcategoryItemId, subcategoryId: where.subcategoryId } : {}) },
        include: {
          category: true,
          brandModel: true,
          productImages: { orderBy: { order: 'asc' }, take: 1 }
        },
        orderBy: { createdAt: 'desc' }
      })
      const filtered = allActive.filter(p =>
        normalize(p.name).includes(sNorm) ||
        normalize(p.brand || '').includes(sNorm) ||
        normalize(p.description || '').includes(sNorm)
      )
      total = filtered.length
      products = filtered.slice(skip, skip + parseInt(limit))
    } else {
      ;[products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            oldPrice: true,
            image: true,
            brand: true,
            stock: true,
            stockAlert: true,
            rating: true,
            reviews: true,
            categoryId: true,
            subcategoryId: true,
            subcategoryItemId: true,
            createdAt: true,  // Important for isNew calculation
            category: { 
              select: { 
                id: true, 
                name: true,
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
            brandModel: { select: { id: true, name: true } },
            productImages: { orderBy: { order: 'asc' }, take: 1, select: { url: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.product.count({ where })
      ])
    }
    
    // Add isNew field to each product
    const productsWithNewFlag = products.map(p => ({
      ...p,
      isNew: isProductNew(p.createdAt)
    }));

    // Retourner avec pagination
    res.json({
      products: productsWithNewFlag,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasMore: skip + products.length < total
      }
    })
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

    const product = await prisma.product.findUnique({
      where: { id },
      select: { categoryId: true, brand: true, type: true, name: true }
    })
    if (!product) return res.status(404).json([])

    // Fetch candidates: same category, exclude self
    const candidates = await prisma.product.findMany({
      where: { active: true, categoryId: product.categoryId, id: { not: id } },
      select: {
        id: true, name: true, brand: true, type: true, price: true,
        oldPrice: true, image: true, stock: true, rating: true,
        category: { select: { name: true } }
      },
      take: 100
    })

    // Score each candidate: brand match + type match
    const scored = candidates.map(p => {
      let score = 10 // base: same category
      if (product.brand && p.brand &&
          p.brand.toLowerCase() === product.brand.toLowerCase()) score += 20
      if (product.type && p.type &&
          p.type.toLowerCase() === product.type.toLowerCase()) score += 15
      return { ...p, _score: score }
    })

    const results = scored
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...p }) => p)

    res.json(results)
  } catch (error) {
    console.error('Similar products error:', error)
    res.status(500).json([])
  }
})

// GET - Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        brandModel: true,
        productImages: {
          orderBy: { order: 'asc' }
        },
        productVariants: true
      }
    })
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé' })
    }
    
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
      price, oldPrice, image, brand, brandId, sku,
      stock, stockAlert, categoryId, subcategoryId, subcategoryItemId,
      type, images, variants, active
    } = req.body
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        usage,
        composition,
        benefits: benefits ? (Array.isArray(benefits) ? benefits : JSON.parse(benefits)) : [],
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        image,
        brand,
        brandId,
        sku,
        stock: parseInt(stock) || 0,
        stockAlert: parseInt(stockAlert) || 10,
        categoryId,
        subcategoryId: subcategoryId || null,
        subcategoryItemId: subcategoryItemId || null,
        type,
        images: images ? (Array.isArray(images) ? images : JSON.parse(images)) : [],
        active: active !== undefined ? active : true
      },
      include: { category: true, brandModel: true, productVariants: true }
    })
    
    // Create variants if provided
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantsToCreate = variants.map(v => ({
        productId: product.id,
        type: v.type || 'taille',
        value: v.value || '',
        priceAdjustment: parseFloat(v.priceAdjustment) || 0,
        stock: parseInt(v.stock) || 0,
        sku: v.sku || null,
        image: v.image || null,
        description: v.description || null
      }))
      await prisma.productVariant.createMany({
        data: variantsToCreate
      })
    }
    
    // Fetch product with variants
    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, brandModel: true, productVariants: true }
    })
    
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
      price, oldPrice, image, brand, brandId, sku,
      rating, reviews, stock, stockAlert,
      categoryId, subcategoryId, subcategoryItemId,
      type, images, variants, active
    } = req.body
    
    // Update product basic fields
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        usage,
        composition,
        benefits: benefits ? (Array.isArray(benefits) ? benefits : JSON.parse(benefits)) : undefined,
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        image,
        brand,
        brandId,
        sku,
        rating: rating ? parseFloat(rating) : undefined,
        reviews: reviews ? parseInt(reviews) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        stockAlert: stockAlert !== undefined ? parseInt(stockAlert) : undefined,
        categoryId,
        subcategoryId: subcategoryId || null,
        subcategoryItemId: subcategoryItemId || null,
        type,
        images: images ? (Array.isArray(images) ? images : JSON.parse(images)) : undefined,
        active
      },
      include: { category: true, brandModel: true, productVariants: true }
    })
    
    // Handle variants update if provided
    if (variants !== undefined && Array.isArray(variants)) {
      // Delete all existing variants and recreate
      await prisma.productVariant.deleteMany({
        where: { productId: id }
      })
      
      if (variants.length > 0) {
        const variantsToCreate = variants.map(v => ({
          productId: id,
          type: v.type || 'taille',
          value: v.value || '',
          priceAdjustment: parseFloat(v.priceAdjustment) || 0,
          stock: parseInt(v.stock) || 0,
          sku: v.sku || null,
          image: v.image || null,
          description: v.description || null
        }))
        await prisma.productVariant.createMany({
          data: variantsToCreate
        })
      }
    }
    
    // Fetch updated product with variants
    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: { category: true, brandModel: true, productVariants: true }
    })
    
    res.json(updatedProduct)
  } catch (error) {
    console.error('Erreur mise à jour produit:', error)
    res.status(500).json({ message: 'Erreur serveur', error: error.message })
  }
})

// POST - Créer une variante pour un produit
router.post('/:id/variants', async (req, res) => {
  try {
    const { id } = req.params
    const { type, value, priceAdjustment, stock, sku, image, description } = req.body
    
    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        type: type || 'taille',
        value: value || '',
        priceAdjustment: parseFloat(priceAdjustment) || 0,
        stock: parseInt(stock) || 0,
        sku: sku || null,
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
    const { type, value, priceAdjustment, stock, sku, image, description } = req.body
    
    const variant = await prisma.productVariant.update({
      where: { id: variantId, productId },
      data: {
        type: type || undefined,
        value: value || undefined,
        priceAdjustment: priceAdjustment !== undefined ? parseFloat(priceAdjustment) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        sku: sku || undefined,
        image: image || undefined,
        description: description || undefined
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

export default router