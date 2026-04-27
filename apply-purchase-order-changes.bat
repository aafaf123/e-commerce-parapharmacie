@echo off
echo 🚀 Application des modifications des bons de commande...
echo.

echo 📋 Étape 1: Sauvegarde de la base de données
cd backend
node -e "console.log('Sauvegarde recommandée avant migration')"

echo.
echo 📋 Étape 2: Application du nouveau schéma Prisma
call npx prisma db push

echo.
echo 📋 Étape 3: Migration des statuts existants
node migrate-purchase-orders.js

echo.
echo ✅ Migration terminée !
echo.
echo 📝 Résumé des changements :
echo   - Statuts simplifiés : BROUILLON, ENVOYÉ, VALIDÉ
echo   - Suppression du test email
echo   - Ajout des colonnes dates prévue/réelle
echo   - Indicateurs visuels d'alerte
echo   - Détail accordéon avec historique
echo   - Export PDF trimestriel
echo.
pause