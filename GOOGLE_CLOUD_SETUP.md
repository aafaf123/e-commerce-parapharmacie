# 🔐 Configuration Google Cloud Console - Erreur 403

## 🎯 Problème

```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

**Cause :** Votre domaine local (localhost:5173) n'est pas autorisé dans Google Cloud Console.

## ✅ Solution - Ajouter les Origines Autorisées

### Étape 1 : Accéder à Google Cloud Console

1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Se connecter avec le compte Google
3. Sélectionner le projet (ou créer un nouveau)

### Étape 2 : Accéder aux Credentials

1. Dans le menu de gauche, cliquer sur **APIs & Services**
2. Cliquer sur **Credentials**
3. Chercher **OAuth 2.0 Client IDs**
4. Cliquer sur le Client ID : `1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com`

### Étape 3 : Ajouter les Origines Autorisées

Dans la section **Authorized JavaScript origins**, ajouter :

```
http://localhost:5173
http://localhost:3000
http://localhost:5174
http://127.0.0.1:5173
http://127.0.0.1:3000
```

### Étape 4 : Ajouter les URIs de Redirection Autorisés

Dans la section **Authorized redirect URIs**, ajouter :

```
http://localhost:5173/
http://localhost:3000/
http://localhost:5174/
http://127.0.0.1:5173/
http://127.0.0.1:3000/
```

### Étape 5 : Sauvegarder

1. Cliquer sur **Save**
2. Attendre quelques secondes pour que les changements se propagent
3. Rafraîchir l'application (Ctrl+F5 ou Cmd+Shift+R)

## 🔍 Vérifier le Port Utilisé

Vérifier quel port utilise votre application :

```bash
cd frontend
npm run dev
```

Chercher dans la sortie :
```
VITE v... ready in ... ms

➜  Local:   http://localhost:5173/
```

**Ajouter ce port exact à Google Cloud Console !**

## 📋 Checklist

- [ ] Accès à Google Cloud Console
- [ ] Projet sélectionné
- [ ] OAuth 2.0 Client ID trouvé
- [ ] Origines autorisées ajoutées (localhost:5173, etc.)
- [ ] URIs de redirection ajoutés
- [ ] Changements sauvegardés
- [ ] Application rafraîchie (Ctrl+F5)

## 🚀 Après Configuration

1. **Rafraîchir l'application** (Ctrl+F5)
2. **Vider le cache** si nécessaire
3. **Redémarrer le serveur frontend** :
   ```bash
   cd frontend
   npm run dev
   ```

## ⏱️ Délai de Propagation

Les changements Google Cloud peuvent prendre :
- ✅ Quelques secondes (généralement)
- ⏳ Jusqu'à 5-10 minutes (dans les cas rares)

Si ça ne fonctionne pas immédiatement, attendre 5 minutes et réessayer.

## 🔧 Dépannage

### Si ça ne fonctionne toujours pas :

1. **Vérifier le Client ID** dans `frontend/src/main.jsx`
   ```javascript
   const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com'
   ```

2. **Vérifier que c'est le bon projet** dans Google Cloud Console

3. **Vérifier les origines exactes** :
   - Pas de slash à la fin pour les origines
   - Slash à la fin pour les URIs de redirection
   - Exemple :
     - ✅ Origine : `http://localhost:5173`
     - ✅ URI : `http://localhost:5173/`

4. **Vider le cache du navigateur** :
   - DevTools → Application → Clear site data
   - Ou Ctrl+Shift+Delete

5. **Essayer un autre navigateur** pour tester

## 📸 Exemple de Configuration

```
Authorized JavaScript origins:
- http://localhost:5173
- http://localhost:3000
- http://127.0.0.1:5173

Authorized redirect URIs:
- http://localhost:5173/
- http://localhost:3000/
- http://127.0.0.1:5173/
```

## 💡 Pour la Production

Quand vous déployez en production, ajouter aussi :

```
Authorized JavaScript origins:
- https://votre-domaine.com
- https://www.votre-domaine.com

Authorized redirect URIs:
- https://votre-domaine.com/
- https://www.votre-domaine.com/
```

---

**Après ces changements, Google Sign-In devrait fonctionner ! ✅**