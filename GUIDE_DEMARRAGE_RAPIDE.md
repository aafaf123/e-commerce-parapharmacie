# 🚀 GUIDE DE DÉMARRAGE RAPIDE

## Problème actuel
```
Failed to resolve import "react-i18next" from "src/components/PromotionSlider.jsx"
```

## Cause
❌ Les dépendances npm ne sont pas installées dans le dossier `frontend/`

## Solution en 3 étapes

### 1️⃣ Installer les dépendances frontend
```bash
cd frontend
npm install
```

### 2️⃣ Installer les dépendances backend  
```bash
cd backend
npm install
```

### 3️⃣ Démarrer le projet
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

## Scripts automatiques disponibles

### Installation complète
```bash
install-all-deps.bat
```

### Installation frontend uniquement
```bash
install-frontend-deps.bat
```

### Installation backend uniquement
```bash
install-backend-deps.bat
```

## Vérification des dépendances

### Frontend (react-i18next confirmé ✅)
- ✅ `react-i18next`: ^17.0.4
- ✅ `i18next`: ^26.0.8  
- ✅ `i18next-browser-languagedetector`: ^8.2.1
- ✅ `react`: ^19.2.4
- ✅ `react-router-dom`: ^6.20.0
- ✅ `lucide-react`: ^0.577.0

### Backend
- ✅ Toutes les dépendances définies dans package.json

## Après l'installation

Le projet devrait démarrer sans erreur :
- 🌐 Frontend: http://localhost:5173
- 🔧 Backend: http://localhost:5000

## En cas de problème persistant

### Nettoyage complet
```bash
# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Backend  
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Vérification des versions Node.js
```bash
node --version  # Recommandé: v18+ ou v20+
npm --version   # Recommandé: v9+
```