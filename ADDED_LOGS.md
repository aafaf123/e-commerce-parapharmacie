# Logs ajoutés pour diagnostiquer le problème AdminUsers

## Fichier modifié : `frontend/src/pages/AdminUsers.jsx`

### 1. useEffect (ligne ~66)
```javascript
console.log(`[${new Date().toISOString()}] [AdminUsers] useEffect - activeTab: ${activeTab}, page: ${currentPage}`);
```
**Objectif** : Vérifier si le useEffect se déclenche correctement et avec quel onglet actif.

---

### 2. checkAuth() (ligne ~75)
```javascript
console.log(`[${new Date().toISOString()}] [AdminUsers] checkAuth - token: ${token ? 'PRESENT' : 'MISSING'}, user: ${userStr || 'NONE'}`);
console.log(`[${new Date().toISOString()}] [AdminUsers] checkAuth - role: ${user?.role}, isAdmin: ${isAdmin}`);
```
**Objectif** : Vérifier la présence du token, le rôle de l'utilisateur et la validation admin.

---

### 3. fetchUsers() (ligne ~100)
```javascript
console.log(`[${new Date().toISOString()}] [AdminUsers] fetchUsers - start, page=${currentPage}, search="${searchTerm}", status=${statusFilter}`);
console.log(`[${new Date().toISOString()}] [AdminUsers] fetchUsers - SUCCESS: ${userCount} users, pagination:`, data?.pagination);
console.error(`[${new Date().toISOString()}] [AdminUsers] fetchUsers - ERROR:`, error);
```
**Objectif** : Diagnostiquer les appels API `/users`, le nombre de résultats et les erreurs (401/403/500).

---

### 4. fetchEmployees() (ligne ~137)
```javascript
console.log(`[${new Date().toISOString()}] [AdminUsers] fetchEmployees - start`);
console.log(`[${new Date().toISOString()}] [AdminUsers] fetchEmployees - SUCCESS: ${empCount} employees`, data);
console.error(`[${new Date().toISOString()}] [AdminUsers] fetchEmployees - ERROR:`, error);
```
**Objectif** : Diagnostiquer les appels API `/employees` pour l'onglet "Rôles du système".

---

### 5. Loading state (ligne ~510)
```javascript
<p className="mt-2 text-xs text-gray-400">[DEBUG] Tab={activeTab} Loading={loading} Users={users.length}</p>
```
**Objectif** : Afficher l'état de chargement et le nombre d'utilisateurs dans l'interface.

---

## Comment lire les logs

Ouvrez **DevTools (F12) → Console** dans Chrome et filtrez par `[AdminUsers]`.

### Scénarios attendus :

**Cas normal (ADMIN avec données) :**
```
[AdminUsers] useEffect - activeTab: clients, page: 1
[AdminUsers] checkAuth - token: PRESENT, user: {...}
[AdminUsers] checkAuth - role: ADMIN, isAdmin: true
[AdminUsers] fetchUsers - start, page=1, search="", status=ALL
[AdminUsers] fetchUsers - SUCCESS: 15 users, pagination: {...}
```

**Problème de token :**
```
[AdminUsers] checkAuth - token: MISSING, user: NONE
[AdminUsers] checkAuth - no token, redirect to /login
```
→ Redirection silencieuse vers /login (vérifier token localStorage)

**Problème de rôle :**
```
[AdminUsers] checkAuth - role: CAISSIER, isAdmin: false
[AdminUsers] checkAuth - not admin, redirect to /
```
→ L'utilisateur n'a pas le rôle suffisant

**Problème API /users :**
```
[AdminUsers] fetchUsers - start, page=1, search="", status=ALL
[AdminUsers] fetchUsers - ERROR: [NetworkError ou 404]
[AdminUsers] fetchUsers - status: 404, data: {...}
```
→ Le backend ne répond pas ou endpoint inexistant

**Onglet Rôles sans employés :**
```
[AdminUsers] fetchEmployees - start
[AdminUsers] fetchEmployees - SUCCESS: 0 employees []
```
→ L'API répond mais le tableau est vide (aucun employé créé)