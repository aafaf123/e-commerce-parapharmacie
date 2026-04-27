import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestVariant() {
  try {
    // Trouver un produit existant
    const product = await prisma.product.findFirst();
    if (!product) {
      console.log('Aucun produit trouvé');
      return;
    }

    console.log('Produit trouvé:', product.name);

    // Créer une variante test
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        type: 'taille',
        value: 'Test M',
        priceHT: 15.00,
        priceTTC: 18.00,
        stock: 10,
        barcode: '1234567890123',
        expiryDate: new Date('2026-12-31'),
        active: true
      }
    });

    console.log('Variante créée:', variant);

    // Vérifier que la variante est bien créée
    const variants = await prisma.productVariant.findMany({
      where: { productId: product.id }
    });

    console.log('Variantes du produit:', variants);

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestVariant();