@echo off
echo 🚀 INSTALLATION COMPLÈTE DU PROJET E-COMMERCE PARAPHARMACIE
echo ============================================================
echo.

echo 📦 1/2 - Installation des dépendances BACKEND...
cd backend
npm install
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'installation des dépendances backend
    pause
    exit /b 1
)
echo ✅ Backend - Dépendances installées avec succès !
echo.

echo 📦 2/2 - Installation des dépendances FRONTEND...
cd ..\frontend
npm install
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'installation des dépendances frontend
    pause
    exit /b 1
)
echo ✅ Frontend - Dépendances installées avec succès !
echo.

cd ..
echo 🎉 INSTALLATION TERMINÉE AVEC SUCCÈS !
echo =====================================
echo.
echo 📋 PROCHAINES ÉTAPES :
echo.
echo 1. Configurer la base de données PostgreSQL :
echo    docker run --name parapharmacie-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=parapharmacie -e POSTGRES_USER=user -p 5432:5432 -d postgres
echo.
echo 2. Configurer le fichier backend/.env avec DATABASE_URL
echo.
echo 3. Initialiser la base de données :
echo    cd backend
echo    npm run db:push
echo    npm run seed
echo.
echo 4. Démarrer le backend :
echo    cd backend
echo    npm run dev
echo.
echo 5. Démarrer le frontend (dans un autre terminal) :
echo    cd frontend
echo    npm run dev
echo.
echo 📖 Consultez le README.md pour plus d'informations
pause