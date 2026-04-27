@echo off
echo 🔧 Correction de l'erreur 404 - Initialisation des données de livraison
echo.

echo 📋 Étape 1: Application du schéma Prisma
cd backend
call npx prisma db push

echo.
echo 📋 Étape 2: Initialisation des données de livraison
node init-delivery-data.js

echo.
echo 📋 Étape 3: Redémarrage du serveur recommandé
echo.
echo ✅ Correction terminée !
echo.
echo 📝 Résumé des corrections :
echo   - Routes de livraison ajoutées (/api/delivery-days/available)
echo   - Routes des zones ajoutées (/api/delivery-zones/districts)
echo   - Données de test créées (villes, quartiers, configurations)
echo   - Configuration des jours de livraison initialisée
echo.
echo 💡 Redémarrez le serveur backend pour appliquer les changements :
echo    cd backend
echo    npm run dev
echo.
pause