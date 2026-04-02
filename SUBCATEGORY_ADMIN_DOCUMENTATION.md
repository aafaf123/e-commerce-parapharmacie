# Documentation: Gestion des Sous-Catégories Admin

## Vue d'ensemble

Cette documentation décrit la section admin pour la gestion des sous-catégories dans l'application e-commerce parapharmacie. La solution permet d'ajouter, modifier et supprimer des sous-catégories et leurs items de manière synchrone avec la base de données PostgreSQL.

## Architecture

### Backend (Node.js/Express/Prisma)

#### Modèles de Base de Données
```prisma
model Category {
  id              String         @id @default(uuid())
  name            String         @unique
  icon            String?
  image           String?
  hasSubcategories Boolean       @default(false)
  order           Int            @default(0)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  products        Product[]
  subcategories   Subcategory[]
}

model Subcategory {
  id          String    @id @default(uuid())
  title       String
  icon        String?
  image       String?
  categoryId  String
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  category    Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  items       SubcategoryItem[]
}

model SubcategoryItem {
  id            String      @id @default(uuid())
  name          String
  subcategoryId String
  order         Int         @default(0)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  subcategory   Subcategory @relation(fields: [subcategoryId], references: [id], onDelete: Cascade)
}
```

#### Endpoints API Admin

**Gestion des Sous-Catégories:**
- `GET /api/admin/categories/subcategories` - Lister toutes les sous-catégories avec pagination et filtres
- `POST /api/admin/categories/subcategories` - Créer une nouvelle sous-catégorie
- `PUT /api/admin/categories/subcategories/:id` - Modifier une sous-catégorie
- `DELETE /api/admin/categories/subcategories/:id` - Supprimer une sous-catégorie
- `GET /api/admin/categories/subcategories/:id` - Récupérer une sous-catégorie spécifique

**Gestion des Items de Sous-Catégories:**
- `POST /api/admin/categories/subcategories/:id/items` - Ajouter un item à une sous-catégorie
- `PUT /api/admin/categories/items/:id` - Modifier un item
- `DELETE /api/admin/categories/items/:id` - Supprimer un item

#### Middleware d'Authentification
- Vérification JWT token
- Vérification rôle admin (ADMIN, CAISSIER, PREPARATEUR)
- Compte utilisateur actif requis

### Frontend (React)

#### Interface Admin
- **URL:** `/admin/subcategories`
- **Composant:** `AdminSubCategories.jsx`
- **Fonctionnalités:**
  - Affichage arborescente des sous-catégories par catégorie
  - Ajout/modification/suppression de sous-catégories
  - Ajout/modification/suppression d'items dans les sous-catégories
  - Pagination et recherche
  - Validation des formulaires
  - Messages de succès/erreur

#### Fonctionnalités Clés
1. **Création de Sous-Catégories:**
   - Sélection de la catégorie parente (non modifiable après création)
   - Titre obligatoire
   - Icône optionnelle (nom Lucide React)
   - Ordre d'affichage

2. **Gestion des Items:**
   - Ajout d'items aux sous-catégories
   - Organisation par ordre
   - Nom obligatoire

3. **Sécurité:**
   - Authentification admin requise
   - Confirmation avant suppression
   - Validation côté client et serveur

## Synchronisation avec la Base de Données

### Relations et Contraintes
- **Cascade Delete:** Suppression d'une sous-catégorie supprime automatiquement ses items
- **Foreign Key:** Chaque sous-catégorie doit appartenir à une catégorie existante
- **Validation:** Vérification de l'existence des catégories avant création/modification

### Transactions
- Les opérations de suppression utilisent des transactions pour garantir l'intégrité
- Suppression en cascade des items avant suppression de la sous-catégorie

## Protection des Catégories Principales

### Design Intentionnel
- **Interface:** L'interface admin ne permet PAS la modification des catégories principales
- **API:** Aucun endpoint admin pour modifier les catégories principales
- **Accès Lecture Seule:** Les catégories sont affichées en lecture seule dans l'interface

### Sécurité
- Les catégories principales sont considérées comme statiques
- Seules les sous-catégories et leurs items sont modifiables
- Les catégories peuvent être consultées mais pas modifiées via l'interface admin

## Utilisation

### 1. Accéder à l'Interface Admin
1. Se connecter en tant qu'admin
2. Naviguer vers `/admin/subcategories`
3. L'interface affiche toutes les sous-catégories groupées par catégorie

### 2. Créer une Sous-Catégorie
1. Cliquer sur "Nouvelle sous-catégorie"
2. Sélectionner la catégorie parente
3. Remplir le titre et options
4. Valider la création

### 3. Gérer les Items
1. Développer une sous-catégorie
2. Cliquer sur "+" pour ajouter un item
3. Modifier/supprimer les items existants

### 4. Modifier/Supprimer
1. Utiliser les icônes d'action (✏️ Modifier, 🗑️ Supprimer)
2. Confirmer les suppressions
3. Les changements sont immédiatement synchronisés avec la base de données

## Points Forts de la Solution

1. **Sécurité:** Authentification robuste et validation des données
2. **Intégrité:** Relations de base de données maintenues via Prisma
3. **Expérience Utilisateur:** Interface intuitive avec feedback en temps réel
4. **Maintenabilité:** Code bien structuré et documenté
5. **Extensibilité:** Architecture permettant d'ajouter facilement de nouvelles fonctionnalités

## Tests

Un script de test est disponible dans `backend/test-subcategories.js` pour vérifier le bon fonctionnement des endpoints API.

## Prochaines Étapes

1. **Démarrer le serveur backend:** `npm start`
2. **Créer un compte admin** si ce n'est pas déjà fait
3. **Tester l'interface** via `/admin/subcategories`
4. **Vérifier la synchronisation** avec pgAdmin

## Conclusion

Cette solution fournit une interface admin complète et sécurisée pour la gestion des sous-catégories, tout en protégeant les catégories principales de toute modification accidentelle. La synchronisation en temps réel avec la base de données garantit l'intégrité des données.