# 🔧 RÉSOLUTION ERREUR i18next

## Problème
```
Failed to resolve import "i18next" from "src/i18n/index.js". Does the file exist?
```

## Cause
Les dépendances npm ne sont pas installées dans le dossier frontend.

## Solution

### Option 1 : Script automatique
Exécutez le script fourni :
```bash
install-frontend-deps.bat
```

### Option 2 : Installation manuelle
```bash
cd frontend
npm install
```

### Option 3 : Installation propre (si problèmes persistants)
```bash
cd frontend
rm -rf node_modules package-lock.json  # ou del /s node_modules package-lock.json sur Windows
npm install
```

## Vérification
Après l'installation, démarrez le frontend :
```bash
cd frontend
npm run dev
```

## Dépendances i18next installées
- `i18next` : Bibliothèque principale d'internationalisation
- `react-i18next` : Intégration React pour i18next
- `i18next-browser-languagedetector` : Détection automatique de la langue

## Langues supportées
- 🇫🇷 Français (par défaut)
- 🇦🇷 Arabe

Les fichiers de traduction sont dans `src/i18n/locales/`.