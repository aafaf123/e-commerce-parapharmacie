// Script pour initialiser les données de livraison
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initDeliveryData() {
  console.log('🚀 Initialisation des données de livraison...');

  try {
    // 1. Créer les configurations de jours de livraison
    console.log('📅 Création des configurations de jours...');
    
    const deliveryDays = [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00', capacity: 10, active: true }, // Lundi
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00', capacity: 10, active: true }, // Mardi
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00', capacity: 10, active: true }, // Mercredi
      { dayOfWeek: 4, startTime: '10:00', endTime: '18:00', capacity: 10, active: true }, // Jeudi
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00', capacity: 8, active: true },  // Vendredi
      { dayOfWeek: 6, startTime: '10:00', endTime: '16:00', capacity: 5, active: true },  // Samedi
      { dayOfWeek: 0, startTime: '10:00', endTime: '16:00', capacity: 0, active: false }, // Dimanche - fermé
    ];

    for (const day of deliveryDays) {
      await prisma.deliveryDayConfig.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: day,
        create: day
      });
    }

    // 2. Créer les villes de livraison
    console.log('🏙️ Création des villes de livraison...');
    
    const cities = [
      { name: 'Casablanca', order: 1 },
      { name: 'Rabat', order: 2 },
      { name: 'Marrakech', order: 3 },
      { name: 'Fès', order: 4 },
      { name: 'Tanger', order: 5 },
      { name: 'Agadir', order: 6 },
      { name: 'Oujda', order: 7 },
      { name: 'Kenitra', order: 8 },
      { name: 'Tétouan', order: 9 },
      { name: 'Safi', order: 10 }
    ];

    const createdCities = {};
    for (const city of cities) {
      const createdCity = await prisma.deliveryCity.upsert({
        where: { name: city.name },
        update: city,
        create: { ...city, active: true }
      });
      createdCities[city.name] = createdCity;
    }

    // 3. Créer les quartiers pour Casablanca (exemple)
    console.log('🏘️ Création des quartiers...');
    
    const casablancaDistricts = [
      { name: 'Maarif', order: 1 },
      { name: 'Gauthier', order: 2 },
      { name: 'Racine', order: 3 },
      { name: 'Bourgogne', order: 4 },
      { name: 'Palmier', order: 5 },
      { name: 'Anfa', order: 6 },
      { name: 'Hay Hassani', order: 7 },
      { name: 'Sidi Bernoussi', order: 8 },
      { name: 'Ain Chock', order: 9 },
      { name: 'Hay Mohammadi', order: 10 }
    ];

    for (const district of casablancaDistricts) {
      await prisma.deliveryDistrict.upsert({
        where: { 
          cityId_name: {
            cityId: createdCities['Casablanca'].id,
            name: district.name
          }
        },
        update: district,
        create: {
          ...district,
          cityId: createdCities['Casablanca'].id,
          active: true
        }
      });
    }

    // Quartiers pour Rabat
    const rabatDistricts = [
      { name: 'Agdal', order: 1 },
      { name: 'Hassan', order: 2 },
      { name: 'Hay Riad', order: 3 },
      { name: 'Souissi', order: 4 },
      { name: 'Océan', order: 5 }
    ];

    for (const district of rabatDistricts) {
      await prisma.deliveryDistrict.upsert({
        where: { 
          cityId_name: {
            cityId: createdCities['Rabat'].id,
            name: district.name
          }
        },
        update: district,
        create: {
          ...district,
          cityId: createdCities['Rabat'].id,
          active: true
        }
      });
    }

    console.log('✅ Données de livraison initialisées avec succès !');
    console.log(`📊 Résumé :`);
    console.log(`   - ${deliveryDays.length} configurations de jours créées`);
    console.log(`   - ${cities.length} villes créées`);
    console.log(`   - ${casablancaDistricts.length + rabatDistricts.length} quartiers créés`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation :', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
initDeliveryData()
  .catch((error) => {
    console.error('Initialisation échouée :', error);
    process.exit(1);
  });