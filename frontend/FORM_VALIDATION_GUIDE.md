# 📋 Guide d'utilisation : React Hook Form + Zod

## 🎯 Vue d'ensemble

Ce projet utilise maintenant **React Hook Form** avec **Zod** pour une validation de formulaires centralisée, type-safe et performante.

## 📁 Structure des fichiers

```
src/
├── lib/
│   └── validationSchemas.js    # Tous les schémas Zod centralisés
├── hooks/
│   └── useValidatedForm.js     # Hooks personnalisés
└── components/
    ├── ContactForm.jsx         # Exemple d'utilisation
    ├── AdvancedSearchForm.jsx  # Formulaire de recherche
    └── ProductReviewForm.jsx   # Formulaire d'avis
```

## 🔧 Schémas de validation disponibles

### Authentification
- `loginSchema` - Connexion utilisateur
- `signupSchema` - Inscription avec validation croisée des mots de passe
- `forgotPasswordSchema` - Demande de réinitialisation
- `resetPasswordSchema` - Nouveau mot de passe
- `adminLoginSchema` - Connexion administrateur

### Profil utilisateur
- `editProfileSchema` - Modification du profil
- `createEmployeeSchema` - Création d'employé

### E-commerce
- `productSchema` - Gestion des produits
- `categorySchema` - Gestion des catégories
- `promotionSchema` - Gestion des promotions
- `deliverySchema` - Adresse de livraison
- `reviewSchema` - Avis produits

### Utilitaires
- `searchSchema` - Recherche avancée
- `contactSchema` - Formulaire de contact

## 🇲🇦 Spécificités Maroc

### Format téléphone
- **Regex**: `/^(\+212|0)[5-7][0-9]{8}$/`
- **Formats acceptés**: `+212612345678` ou `0612345678`
- **Exemples valides**: 
  - `+212 6 12 34 56 78`
  - `0612345678`
  - `+212712345678`

### Montants en DH
- Tous les prix sont en **Dirhams (DH)**
- Messages d'erreur incluent la devise
- Validation minimum: `0.01 DH`

## 🚀 Utilisation basique

### Méthode 1 : React Hook Form standard

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '../lib/validationSchemas'

const LoginForm = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data) => {
    // Logique de soumission
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input 
        {...register('email')} 
        className={errors.email ? 'border-red-500' : 'border-gray-300'}
      />
      {errors.email && <p>{errors.email.message}</p>}
    </form>
  )
}
```

### Méthode 2 : Hook personnalisé (Recommandé)

```jsx
import { useValidatedForm } from '../hooks/useValidatedForm'
import { loginSchema } from '../lib/validationSchemas'

const LoginForm = () => {
  const {
    register,
    handleSubmit,
    isSubmitting,
    ErrorMessage,
    SuccessMessage,
    getFieldClasses,
    FieldError
  } = useValidatedForm(loginSchema)

  const onSubmit = handleSubmit(async (data) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Erreur de connexion')
    }

    return await response.json()
  }, {
    showSuccess: true,
    successMessage: 'Connexion réussie !',
    onSuccess: (result) => {
      // Redirection ou autre logique
      navigate('/dashboard')
    }
  })

  return (
    <form onSubmit={onSubmit}>
      <ErrorMessage />
      <SuccessMessage />
      
      <input 
        {...register('email')} 
        className={getFieldClasses('email')}
      />
      <FieldError name="email" />
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  )
}
```

## 🎨 Hooks spécialisés

### useAuthForm - Pour l'authentification

```jsx
import { useAuthForm } from '../hooks/useValidatedForm'
import { loginSchema } from '../lib/validationSchemas'

const LoginForm = () => {
  const { register, submitWithAuth, isSubmitting } = useAuthForm(loginSchema)

  const onSubmit = submitWithAuth(async (data) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    const result = await response.json()
    
    // Le token et user sont automatiquement sauvegardés
    return result
  })

  return (
    <form onSubmit={onSubmit}>
      {/* Formulaire */}
    </form>
  )
}
```

### useFileForm - Pour l'upload de fichiers

```jsx
import { useFileForm } from '../hooks/useValidatedForm'
import { productSchema } from '../lib/validationSchemas'

const ProductForm = () => {
  const { 
    register, 
    submitWithFiles, 
    uploadProgress, 
    isUploading 
  } = useFileForm(productSchema)

  const onSubmit = submitWithFiles(async (data) => {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value)
    })

    const response = await fetch('/api/products', {
      method: 'POST',
      body: formData
    })

    return await response.json()
  })

  return (
    <form onSubmit={onSubmit}>
      {isUploading && (
        <div className="progress-bar">
          <div style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
      {/* Formulaire */}
    </form>
  )
}
```

## 📝 Création de nouveaux schémas

### Schéma simple

```javascript
// Dans validationSchemas.js
export const newSchema = z.object({
  name: z.string()
    .min(2, 'Nom requis (min 2 caractères)')
    .max(50, 'Nom trop long'),
  email: z.string()
    .email('Format email invalide'),
  phone: z.string()
    .regex(/^(\+212|0)[5-7][0-9]{8}$/, 'Format: +212XXXXXXXXX ou 0XXXXXXXXX'),
  price: z.number()
    .min(0.01, 'Prix minimum: 0.01 DH')
    .max(999999, 'Prix maximum: 999,999 DH')
})
```

### Schéma avec validation croisée

```javascript
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(passwordRegex, 'Doit contenir: majuscule, minuscule, chiffre'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword']
})
```

### Schéma conditionnel

```javascript
export const deliverySchema = z.object({
  type: z.enum(['PICKUP', 'DELIVERY']),
  address: z.string().optional(),
  phone: z.string()
}).refine(data => {
  if (data.type === 'DELIVERY') {
    return data.address && data.address.length >= 10
  }
  return true
}, {
  message: 'Adresse requise pour la livraison',
  path: ['address']
})
```

## 🎯 Bonnes pratiques

### 1. Validation côté client ET serveur
```javascript
// Côté client (React)
const schema = z.object({
  email: z.string().email('Email invalide')
})

// Côté serveur (Express)
app.post('/api/users', (req, res) => {
  try {
    const validData = schema.parse(req.body)
    // Traitement...
  } catch (error) {
    res.status(400).json({ errors: error.errors })
  }
})
```

### 2. Messages d'erreur personnalisés
```javascript
const schema = z.object({
  phone: z.string()
    .regex(/^(\+213|0)[5-7][0-9]{8}$/, 'Format: +213XXXXXXXXX ou 0XXXXXXXXX')
})
```

### 3. Transformation des données
```javascript
const schema = z.object({
  price: z.string()
    .transform(val => parseFloat(val))
    .refine(val => !isNaN(val), 'Prix invalide')
})
```

### 4. Validation optionnelle
```javascript
const schema = z.object({
  newsletter: z.boolean().optional(),
  phone: z.string()
    .optional()
    .or(z.literal(''))  // Accepte chaîne vide
})
```

## 🔍 Débogage

### Afficher les erreurs de validation
```javascript
const { formState: { errors } } = useForm({
  resolver: zodResolver(schema)
})

console.log('Erreurs de validation:', errors)
```

### Tester un schéma
```javascript
import { loginSchema } from '../lib/validationSchemas'

// Test valide
const validData = { email: 'test@example.com', password: 'Password123' }
console.log(loginSchema.parse(validData)) // ✅ Succès

// Test téléphone Maroc
const phoneTest = { phone: '+212612345678' }
console.log(phoneRegex.test(phoneTest.phone)) // ✅ Valide

// Test prix DH
const priceTest = { price: 99.50 }
console.log('Prix valide:', priceTest.price, 'DH') // ✅ 99.50 DH

// Test invalide
try {
  loginSchema.parse({ email: 'invalid', password: '123' })
} catch (error) {
  console.log(error.errors) // ❌ Erreurs détaillées
}
```

## 📊 Avantages de cette approche

✅ **Type Safety** - Validation TypeScript automatique  
✅ **Performance** - Validation côté client rapide  
✅ **Réutilisabilité** - Schémas centralisés  
✅ **Maintenabilité** - Code plus propre et organisé  
✅ **UX** - Messages d'erreur cohérents  
✅ **DX** - Développement plus rapide avec les hooks  

## 🚀 Migration des anciens formulaires

1. **Identifier** les formulaires existants avec `useState`
2. **Créer** le schéma Zod correspondant
3. **Remplacer** `useState` par `useForm` + `zodResolver`
4. **Utiliser** les hooks personnalisés pour simplifier
5. **Tester** la validation et l'UX

## 📚 Ressources

- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [Exemples dans ce projet](./components/)

---

**Note**: Tous les formulaires du projet utilisent maintenant cette approche pour une expérience utilisateur cohérente et un code maintenable.