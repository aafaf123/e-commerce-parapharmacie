# 🔐 Correction Erreur Google OAuth - ERR_CONNECTION_CLOSED

## 🎯 Problème

```
GET https://accounts.google.com/gsi/client net::ERR_CONNECTION_CLOSED
```

L'application tente de charger le script Google Sign-In mais la connexion est fermée.

## 🔍 Causes Possibles

1. **Problème de connexion réseau** - Pas d'accès à accounts.google.com
2. **Proxy/Firewall** - Bloque les requêtes externes
3. **Configuration Google Cloud** - Client ID invalide ou non autorisé
4. **Problème de CORS** - Domaine non autorisé dans Google Cloud Console

## ✅ Solutions

### Solution 1 : Vérifier la Connexion Réseau
```bash
# Tester la connexion à Google
ping accounts.google.com

# Ou avec curl
curl -I https://accounts.google.com/gsi/client
```

### Solution 2 : Vérifier le Client ID Google
1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionner le projet
3. Aller à **Credentials** → **OAuth 2.0 Client IDs**
4. Vérifier que le Client ID est correct
5. Vérifier les **Authorized JavaScript origins** :
   - `http://localhost:3000`
   - `http://localhost:5173`
   - `http://localhost:5174`
   - Votre domaine de production

### Solution 3 : Désactiver Google OAuth Temporairement

Si vous n'avez pas besoin de Google Sign-In pour le développement, vous pouvez le désactiver :

**Modifier `frontend/src/main.jsx` :**
```javascript
// Commenter le GoogleOAuthProvider
// <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <BrowserRouter>
    {/* ... */}
  </BrowserRouter>
// </GoogleOAuthProvider>
```

### Solution 4 : Utiliser un Fallback

L'application a déjà une gestion d'erreur. Si Google OAuth échoue :
- ✅ L'application continue de fonctionner
- ✅ Les utilisateurs peuvent se connecter avec email/mot de passe
- ⚠️ Google Sign-In ne sera pas disponible

### Solution 5 : Vérifier les Autorisations CORS

Ajouter les headers CORS dans le backend si nécessaire :

**`backend/src/server.js` :**
```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://accounts.google.com'
  ],
  credentials: true
}))
```

## 🛠️ Dépannage Avancé

### Vérifier les Logs du Navigateur
1. Ouvrir **DevTools** (F12)
2. Aller à l'onglet **Console**
3. Chercher les erreurs liées à Google
4. Vérifier l'onglet **Network** pour voir les requêtes bloquées

### Vérifier la Configuration Google Cloud

```bash
# Vérifier que le Client ID est valide
# Format: XXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com

# Client ID actuel:
# 1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com
```

### Tester avec cURL

```bash
# Tester le chargement du script Google
curl -v https://accounts.google.com/gsi/client

# Devrait retourner un script JavaScript
```

## 📋 Checklist de Configuration

- [ ] Client ID Google valide
- [ ] Domaine autorisé dans Google Cloud Console
- [ ] Connexion réseau fonctionnelle
- [ ] Pas de proxy/firewall bloquant
- [ ] CORS correctement configuré
- [ ] Pas d'erreurs dans la console du navigateur

## 🚀 Déploiement en Production

Pour la production, assurez-vous que :

1. **Domaine autorisé** dans Google Cloud Console
2. **HTTPS activé** (Google OAuth requiert HTTPS)
3. **Client ID de production** utilisé
4. **Fallback email/password** disponible

## 📞 Support

Si le problème persiste :

1. Vérifier les logs du navigateur (DevTools → Console)
2. Vérifier les logs du serveur backend
3. Vérifier la configuration Google Cloud Console
4. Tester avec un autre navigateur
5. Vider le cache du navigateur

## ℹ️ Note

L'application fonctionne même si Google OAuth échoue. Les utilisateurs peuvent :
- ✅ Se connecter avec email/mot de passe
- ✅ S'inscrire normalement
- ❌ Utiliser Google Sign-In (non disponible)

---

**Status : ✅ Gestion d'erreur implémentée**