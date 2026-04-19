# 🎯 Guide Complet des Variantes de Produit

## Vue d'ensemble

Le système supporte les **variantes de produits** (tailles, couleurs, volumes, etc.) permettant aux clients d'acheter différentes versions d'un même produit.

## 📊 Architecture

### Base de données (Prisma)

```prisma
// 1. Type de variante (créé par l'admin)
model VariantType {
  id: String
  name: String @unique    // "volume", "couleur", "SPF"
  label: String          // "Volume", "Couleur", "Indice SPF"
  values: VariantValue[]
  variants: ProductVariant[]
}

// 2. Valeurs possibles pour une variante
model VariantValue {
  id: String
  variantTypeId: String
  value: String          // "50ml", "100ml", "Bleu", "SPF 50"
  variantType: VariantType
  variants: ProductVariant[]
}

// 3. Instance de variante pour chaque produit
model ProductVariant {
  id: String
  productId: String
  variantTypeId: String?
  variantValueId: String?
  type: String           // "volume"
  value: String          // "50ml"
  price: Float?          // Prix direct si défini
  priceAdjustment: Float // +5 DH par rapport au prix de base
  stock: Int             // Stock spécifique à cette variante
  image: String?         // Image optionnelle de la variante
  description: String?   // Description optionnelle
  product: Product
}

// 4. Enregistrement dans la commande
model OrderItem {
  id: String
  orderId: String
  productId: String
  variantId: String?     // ← ID de la variante si commandée
  quantity: Int
  price: Float
  variantType: String?   // "volume" (sauvegardé pour historique)
  variantValue: String?  // "50ml" (sauvegardé pour historique)
  variant: ProductVariant?
  @@unique([orderId, productId, variantId])
}
```

## 🎨 Frontend

### 1. Affichage dans ProductDetail.jsx

Les variantes sont groupées par type et affichées comme des boutons :

```jsx
{/* Groupe de variantes par type */}
{Object.entries(groupedVariants).map(([type, variantList]) => (
  <div key={type}>
    <p>{type}</p>
    {variantList.map((variant) => (
      <button onClick={() => setSelectedVariant(variant)}>
        {variant.value}
        {variant.price} DH
      </button>
    ))}
  </div>
))}
```

**Fonctionnalités:**
- ✅ Sélection de variante obligatoire si le produit en a
- ✅ Affichage du stock disponible par variante
- ✅ Affichage de l'image et description de la variante
- ✅ Calcul du prix (direct ou prix base + ajustement)

### 2. Panier (Cart.jsx)

Chaque variante est un article distinct :

```jsx
// Clé unique combinant productId et variantId
key={`${item.id}-${item.variantId || ''}`}

// Affichage
{item.variantType && <p>{item.variantType}: {item.variantValue}</p>}
```

### 3. CartContext (Gestion d'état)

```javascript
// Identification unique des articles
const itemId = product.variantId || product.id

// Même variante d'un même produit → consolidation des quantités
// Variantes différentes du même produit → articles distincts

addToCart(product, qty) {
  // Crée un nouvel article pour chaque variante
  // Augmente la quantité si la même variante est ajoutée deux fois
}
```

## 🔄 Flux d'achat

### Étape 1: Sélection (ProductDetail.jsx)

```javascript
const handleAddToCart = () => {
  // ✓ Validation: variante obligatoire si le produit en a
  if (product.productVariants?.length > 0 && !selectedVariant) {
    alert('⚠️ Veuillez sélectionner une variante')
    return
  }

  // Créer l'objet effectif avec données variante
  const effectiveProduct = {
    ...product,
    ...selectedVariant,  // Overrides avec données variante
    price: finalPrice,   // Prix variante ou prix base
    variantId: selectedVariant.id,
    variantType: selectedVariant.type,
    variantValue: selectedVariant.value
  }

  addToCart(effectiveProduct, quantity)
}
```

### Étape 2: Panier (CartContext.jsx)

```javascript
const addToCart = (product, qty) => {
  // Clé unique = productId + variantId
  const itemId = product.variantId || product.id
  
  // Chercher l'article existant
  const existing = cartItems.find(
    item => (item.variantId || item.id) === itemId
  )
  
  if (existing) {
    // Même variante → augmenter la quantité
    updateQuantity(itemId, existing.quantity + qty)
  } else {
    // Nouvelle variante → nouvel article
    addNewItem({ ...product, quantity: qty })
  }
}
```

### Étape 3: Commande (Backend)

```javascript
// backend/src/server.js - POST /api/orders/create

// Normalisation des articles
const normalizedItemsMap = new Map()
items.forEach(rawItem => {
  const key = `${rawItem.id}::${rawItem.variantId || ''}`
  // Consolide les doublons (même product + variante)
})

// Stockage OrderItem avec variante
items.create: [{
  productId: item.id,
  variantId: item.variantId || null,  // ← Clé!
  quantity, price,
  variantType, variantValue          // ← Sauvegarde pour historique
}]

// Décrémentation du stock
// 1. ProductVariant.stock (si variantId)
// 2. Product.stock (toujours)
```

## 💾 Stockage des données

### Dans le localStorage (panier client)

```json
[
  {
    "id": "product-id-123",
    "variantId": "variant-id-456",
    "name": "Gel Nettoyant",
    "type": "volume",
    "value": "50ml",
    "price": 45.00,
    "stock": 10,
    "quantity": 2,
    "image": "url.jpg"
  }
]
```

### Dans la base de données (OrderItem)

```json
{
  "id": "orderitem-789",
  "orderId": "order-123",
  "productId": "product-123",
  "variantId": "variant-456",
  "quantity": 2,
  "price": 45.00,
  "variantType": "volume",
  "variantValue": "50ml"
}
```

## 🛠️ Pour les développeurs

### Créer une variante (Admin API)

```bash
POST /api/products/796b2f07-679c-4b7e-99da-14591f221c93/variants
{
  "type": "volume",
  "value": "100ml",
  "price": 65.00,
  "stock": 25,
  "image": "url-to-variant-image.jpg",
  "description": "Grande taille économique"
}
```

### Récupérer un produit avec variantes

```bash
GET /api/products/796b2f07-679c-4b7e-99da-14591f221c93
```

Réponse inclut `productVariants`:
```json
{
  "id": "product-id",
  "name": "Gel Nettoyant",
  "productVariants": [
    {
      "id": "variant-1",
      "type": "volume",
      "value": "50ml",
      "price": 45.00,
      "stock": 15
    },
    {
      "id": "variant-2",
      "type": "volume",
      "value": "100ml",
      "price": 65.00,
      "stock": 25
    }
  ]
}
```

### Validations importantes

1. **Produit sans variantes**: 
   - `productVariants` tableau vide
   - Acheter le produit directement

2. **Produit avec variantes**:
   - Sélection obligatoire dans UI
   - Backend valide `variantId` si `productVariants` existe

3. **Stock**:
   - Déduit de `ProductVariant.stock` (si existe)
   - Toujours déduit de `Product.stock`

4. **Prix**:
   - `ProductVariant.price` (prix direct) SI défini
   - Sinon: `Product.price + ProductVariant.priceAdjustment`

## 📋 Checklist de test

- [ ] Afficher un produit sans variante → bouton "Ajouter au panier" existe
- [ ] Afficher un produit avec variantes → sélecteur visible
- [ ] Essayer d'ajouter sans sélectionner → alerte ⚠️
- [ ] Sélectionner une variante → prix mis à jour
- [ ] Ajouter au panier → articles distincts pour variantes différentes
- [ ] Consolider → ajouter 2x la même variante → quantité augmente
- [ ] Panier → affiche variante et stock
- [ ] Checkout → commande créée avec `variantId`
- [ ] Confirmation → affiche "Volume: 50ml" etc.

## 🔗 Fichiers importants

| Fichier | Rôle |
|---------|------|
| `frontend/src/pages/ProductDetail.jsx` | Sélection variante, affichage |
| `frontend/src/context/CartContext.jsx` | Gestion panier avec variantes |
| `frontend/src/pages/Cart.jsx` | Affichage panier items |
| `backend/src/routes/products.js` | GET produit + variantes |
| `backend/src/server.js` (line 633) | POST commande avec variantes |
| `backend/prisma/schema.prisma` | Modèles ProductVariant, OrderItem |

## 🚀 Prochaines étapes

Pour améliorer encore:
1. [ ] Filtrer produits par variante (ex: "50ml uniquement")
2. [ ] Revoir variantes à partir du panier
3. [ ] Historique commandes → afficher variantes utilisées
4. [ ] Suggestions: "Vous avez acheté 50ml, essayez 100ml!" 
5. [ ] Réductions par variante
