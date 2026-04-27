# 📸 Guide Visuel - Configuration Google Cloud Console

## 🎯 Objectif

Autoriser `http://localhost:5173` (et autres ports locaux) pour Google Sign-In

## 📍 Étapes Détaillées

### ÉTAPE 1 : Accéder à Google Cloud Console

```
1. Ouvrir : https://console.cloud.google.com
2. Se connecter avec votre compte Google
3. Sélectionner le projet (ou créer un nouveau)
```

### ÉTAPE 2 : Naviguer vers les Credentials

```
Menu de gauche :
├── APIs & Services
│   └── Credentials ← CLIQUER ICI
```

### ÉTAPE 3 : Trouver le Client ID

```
Dans la page Credentials :
├── OAuth 2.0 Client IDs
│   └── Web application
│       └── 1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com
│           └── CLIQUER DESSUS
```

### ÉTAPE 4 : Ajouter les Origines Autorisées

```
Section : "Authorized JavaScript origins"

Ajouter ces lignes (une par une) :
├── http://localhost:5173
├── http://localhost:3000
├── http://localhost:5174
├── http://127.0.0.1:5173
└── http://127.0.0.1:3000
```

**Important :** Pas de slash `/` à la fin !

### ÉTAPE 5 : Ajouter les URIs de Redirection

```
Section : "Authorized redirect URIs"

Ajouter ces lignes (une par une) :
├── http://localhost:5173/
├── http://localhost:3000/
├── http://localhost:5174/
├── http://127.0.0.1:5173/
└── http://127.0.0.1:3000/
```

**Important :** Slash `/` à la fin !

### ÉTAPE 6 : Sauvegarder

```
Bouton en bas : "Save"
└── Cliquer et attendre la confirmation
```

## ⏱️ Après Configuration

```
1. Attendre 5-10 secondes (ou jusqu'à 5 minutes)
2. Rafraîchir l'application : Ctrl+F5 (ou Cmd+Shift+R sur Mac)
3. Vider le cache si nécessaire
4. Redémarrer le serveur frontend si besoin
```

## 🔍 Vérifier la Configuration

### Vérifier le Port Utilisé

```bash
cd frontend
npm run dev
```

Chercher dans la sortie :
```
➜  Local:   http://localhost:5173/
```

**Utiliser ce port exact !**

### Vérifier dans DevTools

1. Ouvrir DevTools (F12)
2. Aller à Console
3. Chercher les messages Google
4. Vérifier qu'il n'y a plus d'erreur 403

## ✅ Signes que ça Fonctionne

```
✅ Pas d'erreur 403 dans la console
✅ Le bouton "Sign in with Google" s'affiche
✅ Cliquer sur le bouton ouvre la fenêtre Google
✅ Vous pouvez vous connecter avec Google
```

## ❌ Si ça ne Fonctionne Pas

### Vérifier 1 : Le Client ID

```javascript
// frontend/src/main.jsx
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'
// ↑ Vérifier que c'est le bon ID
```

### Vérifier 2 : Les Origines Exactes

```
❌ MAUVAIS :
- http://localhost:5173/  (slash à la fin)
- http://localhost:5173:  (deux points)
- localhost:5173          (pas de http://)

✅ BON :
- http://localhost:5173
- http://127.0.0.1:5173
```

### Vérifier 3 : Vider le Cache

```
DevTools → Application → Clear site data
Ou : Ctrl+Shift+Delete
```

### Vérifier 4 : Redémarrer

```bash
# Arrêter le serveur (Ctrl+C)
# Redémarrer
cd frontend
npm run dev
```

## 📋 Checklist Finale

- [ ] Accès à Google Cloud Console ✅
- [ ] Projet sélectionné ✅
- [ ] OAuth 2.0 Client ID trouvé ✅
- [ ] Origines autorisées ajoutées ✅
- [ ] URIs de redirection ajoutés ✅
- [ ] Changements sauvegardés ✅
- [ ] Application rafraîchie ✅
- [ ] Pas d'erreur 403 ✅

## 🎉 Résultat

Après ces étapes, Google Sign-In devrait fonctionner parfaitement !

```
✅ Bouton "Sign in with Google" visible
✅ Clic ouvre la fenêtre Google
✅ Connexion réussie
✅ Pas d'erreur 403
```

---

**Besoin d'aide ?** Consultez `GOOGLE_CLOUD_SETUP.md` pour plus de détails