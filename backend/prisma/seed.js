import { PrismaClient } from '@prisma/client'
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
  await prisma.category.deleteMany()
  await prisma.promoCode.deleteMany()
  await prisma.settings.deleteMany()

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
  const cosmetiqueSubcats = await Promise.all([
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

  // Créer les sous-catégories pour Hygiène & Corps
  await Promise.all([
    prisma.subcategory.create({
      data: {
        title: 'Savons, gels douche',
        icon: 'Waves',
        categoryId: categories[1].id,
        order: 1,
        items: {
          create: [
            { name: 'Savons liquides', order: 1 },
            { name: 'Gels douche', order: 2 },
            { name: 'Savons solides', order: 3 },
            { name: 'Huiles de douche', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Dentifrices et bains de bouche',
        icon: 'Smile',
        categoryId: categories[1].id,
        order: 2,
        items: {
          create: [
            { name: 'Dentifrices', order: 1 },
            { name: 'Bains de bouche', order: 2 },
            { name: 'Brosses à dents', order: 3 },
            { name: 'Fil dentaire', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Déodorants et anti-transpirants',
        icon: 'CircleDot',
        categoryId: categories[1].id,
        order: 3,
        items: {
          create: [
            { name: 'Déodorants spray', order: 1 },
            { name: 'Déodorants roll-on', order: 2 },
            { name: 'Déodorants stick', order: 3 },
            { name: 'Anti-transpirants', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Soins des mains et pieds',
        icon: 'Hand',
        categoryId: categories[1].id,
        order: 4,
        items: {
          create: [
            { name: 'Crèmes mains', order: 1 },
            { name: 'Crèmes pieds', order: 2 },
            { name: 'Gommages', order: 3 },
            { name: 'Masques mains', order: 4 },
          ],
        },
      },
    }),
    prisma.subcategory.create({
      data: {
        title: 'Hygiène intime',
        icon: 'Droplet',
        categoryId: categories[1].id,
        order: 5,
        items: {
          create: [
            { name: 'Gels intimes', order: 1 },
            { name: 'Lingettes intimes', order: 2 },
            { name: 'Déodorants intimes', order: 3 },
            { name: 'Soins apaisants', order: 4 },
          ],
        },
      },
    }),
  ])

  console.log('✅ Sous-catégories créées')

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



// backend/prisma/seed.js - Ajouter cette fonction

async function createAdmin() {
  const bcrypt = require('bcryptjs');
  
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
}

  // Créer les codes promo
  await Promise.all([
    prisma.promoCode.create({
      data: {
        code: 'PROMO10',
        type: 'percentage',
        value: 10,
        description: '10% de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'PROMO20',
        type: 'percentage',
        value: 20,
        description: '20% de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'SAVE50',
        type: 'fixed',
        value: 50,
        description: '50 DH de réduction',
        active: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'SAVE100',
        type: 'fixed',
        value: 100,
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
        key: 'PHARMACY_EMAIL',
        value: 'contact@paraclick.ma',
        description: 'Email de la pharmacie',
      },
    }),
  ])

  console.log('✅ Paramètres créés')
  console.log('🎉 Seeding terminé avec succès!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
