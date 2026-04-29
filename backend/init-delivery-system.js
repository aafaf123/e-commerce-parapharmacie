import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initDeliveryData() {
  try {
    console.log('🚀 Initialisation des données de livraison...');

    // 1. Créer les villes de livraison par défaut
    const cities = [
      { name: 'Casablanca', order: 1 },
      { name: 'Rabat', order: 2 },
      { name: 'Marrakech', order: 3 },
      { name: 'Fès', order: 4 },
      { name: 'Tanger', order: 5 },
      { name: 'Agadir', order: 6 },
      { name: 'Oujda', order: 7 },
      { name: 'Kenitra', order: 8 },
      { name: 'Tetouan', order: 9 },
      { name: 'Safi', order: 10 }
    ];

    for (const city of cities) {
      await prisma.deliveryCity.upsert({
        where: { name: city.name },
        update: { order: city.order },
        create: {
          name: city.name,
          active: true,
          order: city.order
        }
      });
    }

    console.log('✅ Villes de livraison créées');

    // 2. Créer les quartiers pour Casablanca (exemple)
    const casablancaCity = await prisma.deliveryCity.findUnique({
      where: { name: 'Casablanca' }
    });

    if (casablancaCity) {
      const districts = [
        { name: 'Maarif', order: 1 },
        { name: 'Gauthier', order: 2 },
        { name: 'Racine', order: 3 },
        { name: 'Bourgogne', order: 4 },
        { name: 'Palmier', order: 5 },
        { name: 'Anfa', order: 6 },
        { name: 'Ain Diab', order: 7 },
        { name: 'Hay Hassani', order: 8 },
        { name: 'Sidi Bernoussi', order: 9 },
        { name: 'Ain Sebaa', order: 10 }
      ];

      for (const district of districts) {
        await prisma.deliveryDistrict.upsert({
          where: { 
            cityId_name: { 
              cityId: casablancaCity.id, 
              name: district.name 
            } 
          },
          update: { order: district.order },
          create: {
            cityId: casablancaCity.id,
            name: district.name,
            active: true,
            order: district.order
          }
        });
      }

      console.log('✅ Quartiers de Casablanca créés');
    }

    // 3. Créer la configuration des jours de livraison
    const deliveryDays = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', capacity: 10 }, // Lundi
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', capacity: 10 }, // Mardi
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', capacity: 10 }, // Mercredi
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', capacity: 10 }, // Jeudi
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', capacity: 8 },  // Vendredi
      { dayOfWeek: 6, startTime: '10:00', endTime: '16:00', capacity: 6 },  // Samedi
      { dayOfWeek: 0, startTime: '10:00', endTime: '15:00', capacity: 4 }   // Dimanche
    ];

    for (const day of deliveryDays) {
      await prisma.deliveryDayConfig.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        update: {
          startTime: day.startTime,
          endTime: day.endTime,
          capacity: day.capacity,
          active: true
        },
        create: {
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          capacity: day.capacity,
          active: true
        }
      });
    }

    console.log('✅ Configuration des jours de livraison créée');

    // 4. Créer des créneaux de retrait en magasin par défaut
    const storeDays = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '19:00', capacity: 15 }, // Lundi
      { dayOfWeek: 2, startTime: '09:00', endTime: '19:00', capacity: 15 }, // Mardi
      { dayOfWeek: 3, startTime: '09:00', endTime: '19:00', capacity: 15 }, // Mercredi
      { dayOfWeek: 4, startTime: '09:00', endTime: '19:00', capacity: 15 }, // Jeudi
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', capacity: 12 }, // Vendredi
      { dayOfWeek: 6, startTime: '10:00', endTime: '17:00', capacity: 10 }, // Samedi
      { dayOfWeek: 0, startTime: '10:00', endTime: '16:00', capacity: 8 }   // Dimanche
    ];

    for (const day of storeDays) {
      await prisma.timeSlotConfig.upsert({
        where: { 
          dayOfWeek_startTime_type: {
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            type: 'STORE'
          }
        },
        update: {
          endTime: day.endTime,
          capacity: day.capacity,
          active: true
        },
        create: {
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          capacity: day.capacity,
          intervalMinutes: 30,
          active: true,
          type: 'STORE'
        }
      });
    }

    console.log('✅ Configuration des créneaux de retrait créée');

    console.log('🎉 Initialisation des données de livraison terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des données de livraison:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initDeliveryData();
}

export default initDeliveryData;