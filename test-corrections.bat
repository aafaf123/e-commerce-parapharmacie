@echo off
echo ========================================
echo    TEST DES CORRECTIONS APPLIQUEES
echo ========================================
echo.

echo [TEST 1] Verification de la structure des fichiers...
if exist "backend\src\middleware\employeePermissions.js" (
    echo ✅ Middleware permissions employes cree
) else (
    echo ❌ Middleware permissions employes manquant
)

if exist "frontend\src\components\AdminSessionIndicator.jsx" (
    echo ✅ Composant indicateur session admin cree
) else (
    echo ❌ Composant indicateur session admin manquant
)

if exist "backend\init-delivery-system.js" (
    echo ✅ Script initialisation livraison cree
) else (
    echo ❌ Script initialisation livraison manquant
)

if exist "backend\fix-employee-permissions.js" (
    echo ✅ Script correction permissions cree
) else (
    echo ❌ Script correction permissions manquant
)

echo.
echo [TEST 2] Verification de la base de donnees...
cd /d "%~dp0backend"

echo Verification des tables de livraison...
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
  try {
    const cities = await prisma.deliveryCity.count();
    const configs = await prisma.deliveryDayConfig.count();
    const permissions = await prisma.employeePermission.count();
    
    console.log('✅ Villes de livraison:', cities);
    console.log('✅ Configurations jours:', configs);
    console.log('✅ Permissions employes:', permissions);
    
    if (cities === 0) console.log('⚠️  Aucune ville de livraison - Executez init-delivery-system.js');
    if (configs === 0) console.log('⚠️  Aucune config jour - Executez init-delivery-system.js');
    if (permissions === 0) console.log('⚠️  Aucune permission - Executez fix-employee-permissions.js');
    
  } catch (error) {
    console.log('❌ Erreur verification DB:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
"

echo.
echo [TEST 3] Instructions de test manuel...
echo.
echo Pour tester les corrections, suivez ces etapes :
echo.
echo 1. SESSION ADMIN PERSISTANTE :
echo    - Connectez-vous en tant qu'admin
echo    - Cliquez sur "Voir le site"
echo    - Verifiez que l'indicateur bleu apparait en haut
echo    - Cliquez sur "Retour admin" pour revenir
echo.
echo 2. FORMULAIRE TELEPHONE :
echo    - Connectez-vous avec Google (nouveau compte)
echo    - Le formulaire telephone doit apparaitre
echo    - Remplissez-le ou cliquez "Plus tard"
echo    - Deconnectez-vous et reconnectez-vous
echo    - Le formulaire ne doit PAS reapparaitre
echo.
echo 3. PERMISSIONS EMPLOYES :
echo    - Connectez-vous en tant qu'employe
echo    - Verifiez que seuls les modules autorises sont visibles
echo    - Testez les boutons selon les permissions
echo.
echo 4. CRENEAUX LIVRAISON :
echo    - Allez sur une page de commande
echo    - Selectionnez "Livraison a domicile"
echo    - Verifiez que les creneaux de 2h s'affichent
echo.
echo ========================================
echo    TESTS TERMINES
echo ========================================
echo.
pause