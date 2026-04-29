# Guide d'utilisation du système de permissions employés

## Vue d'ensemble

Le système de permissions permet aux administrateurs de contrôler dynamiquement l'accès des employés aux différentes fonctionnalités de l'application. Chaque employé peut avoir des permissions granulaires sur 11 modules avec 4 types d'actions chacun.

## Modules disponibles

- `products` - Gestion des produits
- `orders` - Gestion des commandes  
- `reports` - Rapports et analyses
- `promotions` - Gestion des promotions
- `timeslots` - Gestion des créneaux horaires
- `suppliers` - Gestion des fournisseurs
- `categories` - Gestion des catégories
- `customers` - Gestion des clients
- `inventory` - Gestion des stocks
- `settings` - Paramètres système
- `employees` - Gestion des employés

## Types d'actions

- `canView` - Consulter/Voir
- `canCreate` - Créer
- `canEdit` - Modifier
- `canDelete` - Supprimer

## Utilisation dans les composants

### 1. Hook useEmployeePermissions

```jsx
import { useEmployeePermissions } from '../hooks/useEmployeePermissions';

const MyComponent = () => {
  const { hasPermission, canAccessModule, loading } = useEmployeePermissions();

  // Vérifier l'accès à un module
  if (!canAccessModule('products')) {
    return <div>Accès refusé</div>;
  }

  // Vérifier une permission spécifique
  const canCreateProduct = hasPermission('products', 'canCreate');

  return (
    <div>
      {canCreateProduct && (
        <button>Créer un produit</button>
      )}
    </div>
  );
};
```

### 2. Composant ProtectedRoute

```jsx
import ProtectedRoute from '../components/ProtectedRoute';

// Protéger une section entière
<ProtectedRoute module="products" action="canView">
  <ProductList />
</ProtectedRoute>

// Protéger avec un fallback personnalisé
<ProtectedRoute 
  module="products" 
  action="canCreate"
  fallback={<div>Vous ne pouvez pas créer de produits</div>}
>
  <CreateProductForm />
</ProtectedRoute>

// Masquer silencieusement si pas de permission
<ProtectedRoute module="reports" showMessage={false}>
  <SalesChart />
</ProtectedRoute>
```

### 3. Composant PermissionButton

```jsx
import PermissionButton from '../components/PermissionButton';

// Bouton qui n'apparaît que si l'utilisateur a la permission
<PermissionButton 
  module="products" 
  action="canCreate"
  className="btn btn-primary"
  onClick={handleCreateProduct}
>
  Créer un produit
</PermissionButton>

// Bouton pour supprimer
<PermissionButton 
  module="products" 
  action="canDelete"
  className="btn btn-danger"
  onClick={() => handleDelete(productId)}
>
  Supprimer
</PermissionButton>
```

Ce système permet une gestion fine et dynamique des permissions, s'adaptant automatiquement aux droits accordés par l'administrateur à chaque employé.