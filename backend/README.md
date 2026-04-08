# Backend ParaClick - Documentation

Backend de l'application e-commerce de parapharmacie ParaClick.

## 🏗️ Architecture

### Technologies
- **Node.js** + **Express** - Serveur API REST
- **Prisma** - ORM pour PostgreSQL
- **PostgreSQL** - Base de données
- **Socket.IO** - WebSocket pour notifications temps réel
- **JWT** - Authentification
- **Bcrypt** - Hachage des mots de passe
- **Node-cron** - Tâches planifiées

### Structure du Projet
```
backend/
├── src/
│   ├── server.js           # Point d'entrée principal
│   ├── routes/             # Routes API
│   ├── middleware/         # Middleware d'authentification
│   ├── config/             # Configuration
│   └── locales/            # Internationalisation
├── prisma/
│   ├── schema.prisma       # Schéma de la base de données
│   └── seed.js             # Données initiales
├── .env                    # Variables d'environnement
├── .env.example            # Template des variables
└── package.json            # Dépendances et scripts
```

## 🚀 Installation

### Prérequis
- Node.js 18+ installé
- PostgreSQL installé

### Installation Rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer .env (voir .env.example)
cp .env.example .env
# Éditer .env avec vos identifiants

# 3. Initialiser la base de données
npm run db:push
npm run seed

# 4. Démarrer le serveur
npm run dev
```

Le serveur démarre sur **http://localhost:5000**

## 📋 Scripts Disponibles

```bash
# Développement
npm run dev              # Démarrer avec nodemon (auto-reload)
npm start                # Démarrer en production

# Base de données
npm run migrate          # Créer une migration
npm run db:push          # Pousser le schéma vers la DB
npm run db:studio        # Ouvvrir Prisma Studio
npm run seed             # Peupler la base de données
```

## 🔧 Configuration

### Variables d'Environnement

```env
# Base de données
DATABASE_URL="postgresql://postgres:password@localhost:5432/parapharmacie"

# Serveur
PORT=5000
NODE_ENV="development"

# JWT
JWT_SECRET="votre-secret-jwt-tres-securise"
```

## 📡 API Endpoints

### Authentification
```
POST   /api/auth/signup              # Inscription
POST   /api/auth/login               # Connexion
POST   /api/auth/forgot-password     # Demande de réinitialisation
POST   /api/auth/reset-password      # Réinitialiser le mot de passe
```

### Utilisateur
```
GET    /api/user/profile             # Récupérer le profil
PUT    /api/user/profile             # Modifier le profil
GET    /api/user/cart                # Récupérer le panier
POST   /api/user/cart                # Sauvegarder le panier
```

### Catégories
```
GET    /api/categories               # Toutes les catégories
GET    /api/categories/:id           # Une catégorie
```

### Produits
```
GET    /api/products                 # Tous les produits
GET    /api/products/:id             # Un produit
```

### Codes Promo
```
GET    /api/promo-codes              # Codes actifs
POST   /api/promo-codes/validate     # Valider un code
```

### Commandes
```
POST   /api/orders/create            # Créer une commande
POST   /api/orders/send-confirmation # Envoyer confirmation
GET    /api/orders/my-orders         # Mes commandes
PUT    /api/orders/:id/cancel        # Annuler une commande
PUT    /api/orders/:id/status        # Changer le statut (admin)
```

## 🔔 Notifications Temps Réel (WebSocket)

### Connexion
Le client s'authentifie avec son JWT :
```javascript
socket.emit('authenticate', token)
```

### Événements
```javascript
// Notification reçue
socket.on('notification', (data) => {
  // data.type: 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', etc.
  // data.title: Titre de la notification
  // data.message: Message détaillé
  // data.orderId: ID de la commande
})
```

## 🔐 Sécurité

- JWT avec expiration 7 jours
- Hachage bcrypt des mots de passe
- Middleware de vérification sur routes protégées
- Réinitialisation sécurisée avec token unique (expiration 15 minutes)

## 🗄️ Base de Données

### Modèles Principaux
- **User** : Utilisateurs avec authentification
- **Category** : Catégories de produits
- **Product** : Produits avec détails complets
- **Order** : Commandes Click & Collect
- **Favorite** : Produits favoris
- **PromoCode** : Codes promotionnels

### Commandes Prisma
```bash
npm run db:studio     # Ouvrir l'interface graphique
npm run migrate       # Créer une migration
npm run db:push       # Pousser le schéma
```

## ✨ Fonctionnalités

- ✅ Authentification JWT sécurisée
- ✅ Réinitialisation de mot de passe
- ✅ Notifications temps réel via WebSocket
- ✅ Click & Collect avec créneaux horaires
- ✅ Gestion des commandes avec statuts
- ✅ Codes promotionnels
- ✅ Favoris utilisateur
- ✅ Panier persistant
- ✅ Catalogue de produits avec filtres

---

**Bon développement ! 🚀**