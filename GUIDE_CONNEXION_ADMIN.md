// GUIDE DE DÉMARRAGE - CONNEXION ADMIN

## 🚀 Configuration des ports
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- API Proxy: /api → http://localhost:5000

## 📋 Étapes de démarrage

### 1. Démarrer PostgreSQL
```bash
docker run --name parapharmacie-pg -e POSTGRES_PASSWORD=hhhhf -e POSTGRES_DB=parapharmacie -e POSTGRES_USER=postgres -p 5432:5432 -d postgres
```

### 2. Démarrer le Backend
```bash
cd backend
npm install
npm run dev
```
✅ Backend disponible sur: http://localhost:5000

### 3. Démarrer le Frontend
```bash
cd frontend
npm install
npm run dev
```
✅ Frontend disponible sur: http://localhost:3000

## 🔐 Connexion Admin

### Credentials :
```
Email: admin@parapharmacie.ma
Mot de passe: admin123
```

### URL de connexion :
```
http://localhost:3000/admin/login
```

## 🔧 Architecture d'authentification

### Frontend (React + Context)
- `frontend/src/context/AuthContextNew.jsx` - Contexte d'authentification avec useState
- `frontend/src/pages/AdminLogin.jsx` - Page de connexion admin
- `frontend/src/components/AdminRoute.jsx` - Protection des routes admin

### Backend (Node.js + Express)
- `backend/src/routes/admin.js` - Route POST /api/admin/login
- Table: `Admin` (PostgreSQL)

## 📝 Flux de connexion admin

1. Utilisateur accède à http://localhost:3000/admin/login
2. Saisit email et mot de passe
3. Frontend envoie POST /api/admin/login
4. Backend vérifie les credentials dans la table Admin
5. Backend retourne un JWT token
6. Frontend stocke le token et l'utilisateur dans localStorage
7. Redirection vers /admin/dashboard

## ✅ Vérification

Pour vérifier que l'admin existe en base :
```bash
cd backend
node create-admin-final.js
```

Résultat attendu:
```
✅ Admin existe déjà: admin@parapharmacie.ma
   Actif: true
```

## 🐛 Troubleshooting

### Erreur: "Accès administrateur non autorisé"
- Vérifier que l'email est exactement: admin@parapharmacie.ma
- Vérifier que le mot de passe est: admin123
- Vérifier que l'admin existe en base: `node create-admin-final.js`

### Erreur: "Page blanche"
- Vérifier que le backend est démarré sur le port 5000
- Vérifier que le proxy API est configuré dans vite.config.js
- Ouvrir la console du navigateur (F12) pour voir les erreurs

### Erreur: "Cannot GET /admin/login"
- Vérifier que le frontend est démarré sur le port 3000
- Vérifier que les routes sont correctement configurées dans frontend/src/routes/index.jsx

## 📚 Fichiers importants

Frontend:
- `frontend/src/context/AuthContextNew.jsx` - Logique d'authentification
- `frontend/src/pages/AdminLogin.jsx` - Interface de connexion
- `frontend/src/components/AdminRoute.jsx` - Protection des routes

Backend:
- `backend/src/routes/admin.js` - Endpoint /api/admin/login
- `backend/prisma/schema.prisma` - Schéma de la table Admin
- `backend/.env` - Configuration (DATABASE_URL, JWT_SECRET)

## 🎯 Prochaines étapes

Après la connexion admin réussie:
1. Accès au dashboard: http://localhost:3000/admin/dashboard
2. Gestion des produits, commandes, etc.
3. Gestion des employés et permissions
