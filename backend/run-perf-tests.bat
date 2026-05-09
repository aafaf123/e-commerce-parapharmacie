@echo off
REM run-perf-tests.bat
REM Lance tous les tests de performance k6 en séquence
REM Usage : run-perf-tests.bat [smoke|load|stress|all]
REM Exemple : run-perf-tests.bat smoke

SET K6="C:\Program Files\k6\k6.exe"
SET BASE_URL=http://localhost:5000
SET TESTS_DIR=tests\performance
SET MODE=%1

IF "%MODE%"=="" SET MODE=load

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║       TESTS DE PERFORMANCE — ParaClick API           ║
echo ║       Mode : %MODE%                                   
echo ╚══════════════════════════════════════════════════════╝
echo.
echo Serveur cible : %BASE_URL%
echo.

REM Vérifier que le serveur est démarré
curl -s -o nul -w "%%{http_code}" %BASE_URL%/api/health | findstr "200" >nul
IF ERRORLEVEL 1 (
  echo ❌ ERREUR : Le serveur n'est pas accessible sur %BASE_URL%
  echo    Démarrez le backend avec : cd backend ^&^& npm run dev
  exit /b 1
)
echo ✅ Serveur accessible
echo.

REM ── 01 Endpoints publics ──────────────────────────────────────────────────
echo [1/5] Test endpoints publics...
%K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\01_public_endpoints.js
echo.

REM ── 02 Authentification ───────────────────────────────────────────────────
echo [2/5] Test authentification...
%K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\02_auth.js
echo.

REM ── 03 Commandes ──────────────────────────────────────────────────────────
echo [3/5] Test commandes...
%K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\03_orders.js
echo.

REM ── 04 Dashboard admin ────────────────────────────────────────────────────
echo [4/5] Test dashboard admin...
%K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\04_admin_dashboard.js
echo.

REM ── 05 Parcours utilisateur ───────────────────────────────────────────────
echo [5/5] Test parcours utilisateur complet...
%K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\05_user_journey.js
echo.

REM ── Stress test (optionnel) ───────────────────────────────────────────────
IF "%MODE%"=="stress" (
  echo [STRESS] Test de stress...
  %K6% run --env BASE_URL=%BASE_URL% %TESTS_DIR%\06_stress.js
  echo.
)

echo ╔══════════════════════════════════════════════════════╗
echo ║  ✅ Tous les tests terminés                          ║
echo ║  📁 Rapports : tests\performance\reports\            ║
echo ╚══════════════════════════════════════════════════════╝
