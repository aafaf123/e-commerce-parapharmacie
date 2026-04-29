// backend/prisma/seed.js
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Charger les variables d'environnement depuis .env
const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Début du seeding...')

  // Nettoyer la base de données
  await prisma.subcategoryItem.deleteMany()
  await prisma.subcategory.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.variantValue.deleteMany()
  await prisma.variantType.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.category.deleteMany()
  await prisma.promoCode.deleteMany()
  await prisma.settings.deleteMany()
  await prisma.user.deleteMany()

  // Créer les catégories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Cosmétiques & Soin',
        icon: 'Sparkles',
        hasSubcategories: true,
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Hygiène & Corps',
        icon: 'Droplets',
        hasSubcategories: true,
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Bébé & Maternité',
        icon: 'Baby',
        hasSubcategories: true,
        order: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Complémentaires',
        icon: 'Pill',
        hasSubcategories: true,
        order: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Solaire & Protection',
        icon: 'Sun',
        hasSubcategories: true,
        order: 5,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Orthopédique',
        icon: 'Stethoscope',
        hasSubcategories: true,
        order: 6,
      },
    }),
  ])

  console.log('✅ Catégories créées')

  // Créer les sous-catégories pour Cosmétiques & Soin
  await Promise.all([
    prisma.subcategory.create({
      data: {
        title: 'Soins Visage',
        icon: 'Sparkle',
        categoryId: categories[0].id,
        order: 1,
        items: {
          create: [
            { name: 'Nettoyants', order: 1 },
            { name: 'Hydratants', order: 2 },
            { name: 'Anti-âge', order: 3 },
            { name: 'Soins ciblés', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Soins Corps',
        icon: 'Droplet',
        categoryId: categories[0].id,
        order: 2,
        items: {
          create: [
            { name: 'Laits corporels', order: 1 },
            { name: 'Baumes', order: 2 },
            { name: 'Gommages', order: 3 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Produits Capillaires',
        icon: 'Wind',
        categoryId: categories[0].id,
        order: 3,
        items: {
          create: [
            { name: 'Shampooings', order: 1 },
            { name: 'Après-shampooings', order: 2 },
            { name: 'Masques capillaires', order: 3 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Soins bio cheveux',
        icon: 'Wind',
        categoryId: categories[0].id,
        order: 4,
        items: {
          create: [
            { name: 'Shampooings bio', order: 1 },
            { name: 'Après-shampooings bio', order: 2 },
            { name: 'Masques bio', order: 3 },
            { name: 'Huiles capillaires bio', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Soins bio visage',
        icon: 'Sparkle',
        categoryId: categories[0].id,
        order: 5,
        items: {
          create: [
            { name: 'Nettoyants bio', order: 1 },
            { name: 'Crèmes bio', order: 2 },
            { name: 'Sérums bio', order: 3 },
            { name: 'Huiles visage bio', order: 4 },
          ],
        },
      },
    }),
  ])

  console.log('✅ Sous-catégories créées')

  // Créer les marques
  const brands = await Promise.all([
    prisma.brand.create({
      data: { name: 'CeraVe', description: 'Marque de soins de la peau recommandée par les dermatologues', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Vichy', description: 'Laboratoire dermatologique français', active: true },
    }),
    prisma.brand.create({
      data: { name: 'La Roche-Posay', description: 'Marque de soins dermatologiques', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Bioderma', description: 'Expert en biologie cutanée', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Nuxe', description: 'Cosmétiques français d\'origine naturelle', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Avène', description: 'Thermal skincare', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Mustela', description: 'Spécialiste puériculture et беременности', active: true },
    }),
    prisma.brand.create({
      data: { name: 'Uriage', description: 'Eau thermale et soins dermatologiques', active: true },
    }),
  ])

  console.log('✅ Marques créées')

  // Créer les types de variantes
  const variantTypes = await Promise.all([
    prisma.variantType.create({ data: { name: 'volume', label: 'Volume', order: 1 } }),
    prisma.variantType.create({ data: { name: 'spf', label: 'Indice SPF', order: 2 } }),
    prisma.variantType.create({ data: { name: 'format', label: 'Format', order: 3 } }),
    prisma.variantType.create({ data: { name: 'typeCheveux', label: 'Type de cheveux', order: 4 } }),
    prisma.variantType.create({ data: { name: 'typePeau', label: 'Type de peau', order: 5 } }),
    prisma.variantType.create({ data: { name: 'dosage', label: 'Dosage', order: 6 } }),
    prisma.variantType.create({ data: { name: 'parfum', label: 'Parfum', order: 7 } }),
  ])

  // Créer les valeurs par défaut pour chaque type
  const variantValuesData = {
    volume: ['30ml', '50ml', '100ml', '150ml', '200ml', '250ml', '300ml', '500ml', '1L'],
    spf: ['SPF 15', 'SPF 20', 'SPF 25', 'SPF 30', 'SPF 40', 'SPF 50', 'SPF 50+'],
    format: ['Spray', 'Tube', 'Pompe', 'Flacon', 'Stick', 'Sachet', 'Ampoule', 'Capsule'],
    typeCheveux: ['Sec', 'Gras', 'Mixtes', 'Colorés', 'Bouclés', 'Frisés', 'Lisses', 'Fins', 'Abîmés'],
    typePeau: ['Sèche', 'Mixte', 'Grasse', 'Sensible', 'Normale', 'À problèmes', 'Mature'],
    dosage: ['0.5%', '1%', '2%', '5%', '10%', '15%', '20%'],
    parfum: ['Floral', 'Fruité', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Vanille', 'Lavande', 'Sans parfum'],
  }

  for (const vt of variantTypes) {
    const values = variantValuesData[vt.name] || []
    for (let i = 0; i < values.length; i++) {
      await prisma.variantValue.create({
        data: { variantTypeId: vt.id, value: values[i], order: i }
      })
    }
  }

  console.log('✅ Types de variantes créés')

  // Créer les produits
  await Promise.all([
    prisma.product.create({
      data: {
        name: 'Crème Hydratante Visage CeraVe',
        brand: 'CeraVe',
        price: 129.9,
        oldPrice: 189.9,
        image: '/images/cerave.jpg',
        rating: 5,
        reviews: 128,
        stock: 15,
        categoryId: categories[0].id,
        type: 'hydratants',
        description: 'Crème hydratante pour le visage développée avec des dermatologues.',
        usage: 'Appliquer matin et soir sur une peau propre et sèche.',
        composition: 'Céramides, Acide hyaluronique, Niacinamide',
        benefits: JSON.stringify(['Hydratation 24h', 'Restaure la barrière cutanée', 'Non comédogène']),
      },
    }),
    prisma.product.create({
      data: {
        name: 'Gel Nettoyant CeraVe 200ml',
        brand: 'CeraVe',
        price: 89.9,
        oldPrice: 89.9,
        image: '/images/cerave.jpg',
        rating: 5,
        reviews: 85,
        stock: 22,
        categoryId: categories[0].id,
        type: 'nettoyants',
        description: 'Gel nettoyant moussant pour peaux normales à grasses.',
        usage: 'Appliquer sur peau humide, masser et rincer.',
        composition: 'Céramides, Niacinamide, Acide hyaluronique',
        benefits: JSON.stringify(['Nettoie en douceur', 'Élimine excès de sébum', 'Respecte le pH']),
      },
    }),
    prisma.product.create({
      data: {
        name: 'Lotion Hydratante CeraVe 473ml',
        brand: 'CeraVe',
        price: 249.9,
        oldPrice: 329.9,
        image: '/images/cerave.jpg',
        rating: 5,
        reviews: 256,
        stock: 3,
        categoryId: categories[0].id,
        type: 'laits corporels',
        description: 'Lotion hydratante corps pour peaux sèches.',
        usage: 'Appliquer généreusement sur le corps.',
        composition: 'Céramides, Acide hyaluronique',
        benefits: JSON.stringify(['Hydratation longue durée', 'Texture légère', 'Absorption rapide']),
      },
    }),
    prisma.product.create({
      data: {
        name: 'Lait Corps Hydratant Mixa',
        brand: 'Mixa',
        price: 59.9,
        oldPrice: 79.9,
        image: '/images/laitCorpsMixa.webp',
        rating: 5,
        reviews: 278,
        stock: 45,
        categoryId: categories[0].id,
        type: 'laits corporels',
        description: 'Lait corporel enrichi en glycérine.',
        usage: 'Appliquer quotidiennement après la douche.',
        composition: 'Glycérine, Pro-vitamine B5',
        benefits: JSON.stringify(['Hydrate intensément', 'Apaise', 'Peaux sensibles']),
      },
    }),
    prisma.product.create({
      data: {
        name: 'Gel Nettoyant Doux Avene',
        brand: 'Avene',
        price: 119.9,
        oldPrice: 149.9,
        image: '/images/gelAvene.webp',
        rating: 4,
        reviews: 134,
        stock: 22,
        categoryId: categories[1].id,
        type: 'gel',
        description: 'Gel nettoyant doux à l\'eau thermale Avène.',
        usage: 'Appliquer sur peau humide, faire mousser et rincer.',
        composition: 'Eau thermale Avène, Agents nettoyants doux',
        benefits: JSON.stringify(['Nettoie en douceur', 'Apaise', 'Hypoallergénique']),
      },
    }),
  ])

  console.log('✅ Produits créés')

  // Créer l'admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@parapharmacie.ma';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'ParaClick',
        phone: '0600000000',
        address: 'Pharmacie ParaClick, Casablanca',
        role: 'ADMIN',
        isActive: true
      }
    });
    console.log('✅ Admin créé avec succès');
  } else {
    console.log('⚠️ Admin existe déjà');
  }

  // Créer les codes promo
  await Promise.all([
    prisma.promoCode.create({
      data: {
        code: 'PROMO10',
        discountType: 'percentage',
        discountValue: 10,
        description: '10% de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'PROMO20',
        discountType: 'percentage',
        discountValue: 20,
        description: '20% de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'SAVE50',
        discountType: 'fixed',
        discountValue: 50,
        description: '50 DH de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'SAVE100',
        discountType: 'fixed',
        discountValue: 100,
        description: '100 DH de réduction',
        active: true,
      },
    }),
  ])

  console.log('✅ Codes promo créés')

  // Créer les paramètres
  await Promise.all([
    prisma.settings.create({
      data: {
        key: 'TVA_RATE',
        value: '0.19',
        description: 'Taux de TVA (19%)',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'FREE_SHIPPING_THRESHOLD',
        value: '300',
        description: 'Seuil de livraison gratuite en DH',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'PHARMACY_NAME',
        value: 'ParaClick',
        description: 'Nom de la pharmacie',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'PHARMACY_ADDRESS',
        value: '123 Avenue Mohammed V, Casablanca',
        description: 'Adresse de la pharmacie',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'PHARMACY_PHONE',
        value: '+212 5 22 XX XX XX',
        description: 'Téléphone de la pharmacie',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'DELIVERY_FEE',
        value: '25',
        description: 'Frais de livraison à domicile en DH',
      },
    }),
    prisma.settings.create({
      data: {
        key: 'PHARMACY_EMAIL',
        value: 'contact@paraclick.ma',
        description: 'Email de la pharmacie',
      },
    }),
  ])

  console.log('✅ Paramètres créés')
  console.log('🎉 Seeding terminé avec succès!')
}
// backend/prisma/seed.js
// Ajoutez ce bloc après la création des paramètres

  // Créer des promotions de test
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(now.getMonth() + 1);
  const twoWeeksLater = new Date(now);
  twoWeeksLater.setDate(now.getDate() + 14);

  console.log('📢 Création des promotions de test...');
  
  await prisma.promotion.createMany({
    data: [
      {
        title: 'OFFRE FLASH -20%',
        titleAr: 'عرض فلاش -20%',
        subtitle: 'Sur toute la parapharmacie',
        subtitleAr: 'على جميع منتجات البارافارماسي',
        description: 'Profitez de 20% de réduction sur tous les produits',
        descriptionAr: 'استفد من خصم 20% على جميع المنتجات',
        bannerImage: '/images/promo-banner-1.jpg',
        discountType: 'percentage',
        discountValue: 20,
        badge: 'FLASH',
        badgeColor: 'bg-red-500',
        bgColor: 'bg-gradient-to-r from-red-600 to-red-700',
        iconName: 'Zap',
        features: ['Livraison offerte', 'Paiement sécurisé', 'Retrait en pharmacie'],
        featuresAr: ['توصيل مجاني', 'دفع آمن', 'سحب من الصيدلية'],
        ctaText: 'Profiter maintenant',
        ctaTextAr: 'استفد الآن',
        active: true,
        order: 1,
        startDate: oneWeekAgo,
        endDate: twoWeeksLater
      },
      {
        title: 'BEAUTÉ EXPRESS',
        titleAr: 'بيوتي إكسبرس',
        subtitle: 'Jusqu\'à 30% sur les soins visage',
        subtitleAr: 'حتى 30% على العناية بالوجه',
        description: 'Découvrez notre sélection de soins visage à prix réduits',
        descriptionAr: 'اكتشفوا تشكيلة منتجات العناية بالوجه بأسعار مخفضة',
        bannerImage: '/images/promo-banner-2.jpg',
        discountType: 'percentage',
        discountValue: 30,
        productName: 'Soins Visage',
        badge: 'LIMITÉE',
        badgeColor: 'bg-purple-500',
        bgColor: 'bg-gradient-to-r from-purple-700 to-purple-800',
        iconName: 'Sparkles',
        features: ['Produits premium', 'Résultats garantis', 'Offre exclusive'],
        featuresAr: ['منتجات فاخرة', 'نتائج مضمونة', 'عرض حصري'],
        ctaText: 'Je profite',
        ctaTextAr: 'أستفيد',
        active: true,
        order: 2,
        startDate: oneWeekAgo,
        endDate: oneMonthLater
      },
      {
        title: 'NOUVEAUTÉS',
        titleAr: 'وصل حديثاً',
        subtitle: 'Découvrez les dernières tendances',
        subtitleAr: 'اكتشفوا أحدث الصيحات',
        description: 'Les nouveautés de la saison sont arrivées',
        descriptionAr: 'وصلت جديد الموسم',
        bannerImage: '/images/promo-banner-3.jpg',
        discountType: 'percentage',
        discountValue: 15,
        badge: 'NOUVEAU',
        badgeColor: 'bg-green-500',
        bgColor: 'bg-gradient-to-r from-green-700 to-green-800',
        iconName: 'Gift',
        features: ['Nouveautés exclusives', 'Premiers arrivages', 'Quantités limitées'],
        featuresAr: ['جديد حصري', 'أول وصول', 'كميات محدودة'],
        ctaText: 'Voir les nouveautés',
        ctaTextAr: 'تصفح الجديد',
        active: true,
        order: 3,
        startDate: oneWeekAgo,
        endDate: oneMonthLater
      }
    ]
  });

  console.log('✅ Promotions de test créées');

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })