// Script pour nettoyer les produits de promotions existants
// Ce script déplace tous les produits liés aux promotions vers la catégorie "Promotions"

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupPromotionProducts() {
  try {
    console.log('🧹 Nettoyage des produits de promotions...');

    // 1. Trouver ou créer la catégorie "Promotions"
    let promoCategory = await prisma.category.findFirst({ 
      where: { name: 'Promotions' } 
    });

    if (!promoCategory) {
      console.log('📁 Création de la catégorie "Promotions"...');
      promoCategory = await prisma.category.create({
        data: {
          name: 'Promotions',
          icon: 'Tag',
          order: 999 // Mettre en dernier
        }
      });
      console.log('✅ Catégorie "Promotions" créée');
    } else {
      console.log('✅ Catégorie "Promotions" trouvée');
    }

    // 2. Trouver tous les produits liés aux promotions
    const promotions = await prisma.promotion.findMany({
      where: {
        productId: { not: null }
      },
      select: {
        id: true,
        productId: true,
        title: true
      }
    });

    console.log(`📦 ${promotions.length} promotion(s) avec des produits liés trouvées`);

    // 3. Déplacer ces produits vers la catégorie "Promotions"
    let movedCount = 0;
    for (const promo of promotions) {
      if (promo.productId) {
        const product = await prisma.product.findUnique({
          where: { id: promo.productId },
          select: { id: true, name: true, categoryId: true }
        });

        if (product && product.categoryId !== promoCategory.id) {
          await prisma.product.update({
            where: { id: promo.productId },
            data: { 
              categoryId: promoCategory.id,
              active: true // S'assurer qu'il est actif mais dans la catégorie cachée
            }
          });
          console.log(`📦 Produit "${product.name}" déplacé vers la catégorie Promotions`);
          movedCount++;
        }
      }
    }

    console.log(`✅ ${movedCount} produit(s) déplacé(s) vers la catégorie "Promotions"`);

    // 4. Optionnel : Supprimer les produits orphelins (produits dans d'autres catégories mais avec des noms de promotions)
    const orphanProducts = await prisma.product.findMany({
      where: {
        AND: [
          { categoryId: { not: promoCategory.id } },
          { 
            OR: [
              { name: { contains: 'Promotion', mode: 'insensitive' } },
              { name: { contains: 'Promo', mode: 'insensitive' } },
              { name: { contains: 'Offre', mode: 'insensitive' } },
              { brand: { contains: 'Promo', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (orphanProducts.length > 0) {
      console.log(`🔍 ${orphanProducts.length} produit(s) potentiellement orphelin(s) trouvé(s):`);
      orphanProducts.forEach(p => {
        console.log(`   - ${p.name} (ID: ${p.id})`);
      });

      // Déplacer ces produits aussi vers la catégorie Promotions
      for (const product of orphanProducts) {
        await prisma.product.update({
          where: { id: product.id },
          data: { categoryId: promoCategory.id }
        });
      }
      console.log(`✅ ${orphanProducts.length} produit(s) orphelin(s) déplacé(s)`);
    }

    console.log('🎉 Nettoyage terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
cleanupPromotionProducts();