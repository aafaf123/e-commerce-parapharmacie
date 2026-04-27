@echo off
echo 🔐 Gestionnaire Google OAuth
echo.
echo 1. Utiliser main.jsx (AVEC Google OAuth)
echo 2. Utiliser main.dev.jsx (SANS Google OAuth - Développement)
echo 3. Afficher le statut actuel
echo.
set /p choice="Choisissez une option (1-3): "

if "%choice%"=="1" (
    echo.
    echo ✅ Basculement vers main.jsx (AVEC Google OAuth)...
    cd frontend\src
    if exist main.jsx (
        echo main.jsx est déjà actif
    ) else (
        echo Erreur: main.jsx non trouvé
    )
    cd ..\..
    echo.
    echo 📝 Pour démarrer: cd frontend && npm run dev
    echo.
) else if "%choice%"=="2" (
    echo.
    echo ✅ Basculement vers main.dev.jsx (SANS Google OAuth)...
    cd frontend\src
    if exist main.dev.jsx (
        echo Renommage main.jsx en main.backup.jsx...
        ren main.jsx main.backup.jsx
        echo Renommage main.dev.jsx en main.jsx...
        ren main.dev.jsx main.jsx
        echo ✅ Basculement réussi!
    ) else (
        echo Erreur: main.dev.jsx non trouvé
    )
    cd ..\..
    echo.
    echo 📝 Pour démarrer: cd frontend && npm run dev
    echo.
) else if "%choice%"=="3" (
    echo.
    echo 📊 Statut actuel:
    cd frontend\src
    if exist main.jsx (
        echo ✅ main.jsx existe
        echo.
        echo Contenu (première ligne):
        for /f "delims=" %%A in (main.jsx) do (
            echo %%A
            goto :done
        )
        :done
    )
    if exist main.dev.jsx (
        echo ✅ main.dev.jsx existe
    )
    if exist main.backup.jsx (
        echo ✅ main.backup.jsx existe (sauvegarde)
    )
    cd ..\..
    echo.
) else (
    echo ❌ Option invalide
)

pause