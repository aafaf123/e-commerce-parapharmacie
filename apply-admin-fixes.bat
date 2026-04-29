@echo off
echo ========================================
echo    CORRECTION SYSTEME ADMIN/EMPLOYES
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Initialisation du systeme de livraison...
node init-delivery-system.js
if %errorlevel% neq 0 (
    echo ERREUR: Echec de l'initialisation du systeme de livraison
    pause
    exit /b 1
)
echo ✅ Systeme de livraison initialise avec succes
echo.

echo [2/3] Correction des permissions des employes...
node fix-employee-permissions.js
if %errorlevel% neq 0 (
    echo ERREUR: Echec de la correction des permissions
    pause
    exit /b 1
)
echo ✅ Permissions des employes corrigees avec succes
echo.

echo [3/3] Synchronisation de la base de donnees...
npm run db:push
if %errorlevel% neq 0 (
    echo ERREUR: Echec de la synchronisation de la base de donnees
    pause
    exit /b 1
)
echo ✅ Base de donnees synchronisee avec succes
echo.

echo ========================================
echo    CORRECTIONS APPLIQUEES AVEC SUCCES
echo ========================================
echo.
echo Les corrections suivantes ont ete appliquees :
echo - ✅ Persistance de la session admin/employe
echo - ✅ Creneaux de livraison a domicile fonctionnels
echo - ✅ Permissions employes specifiques par role
echo.
echo Vous pouvez maintenant redemarrer le serveur backend :
echo   cd backend
echo   npm run dev
echo.
echo Et tester les fonctionnalites corrigees.
echo.
pause