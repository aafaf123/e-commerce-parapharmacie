# Déploiement Docker

## Architecture
```
[Browser] → Nginx:80 → /api/*      → Backend:5000 → PostgreSQL:5432
                      → /socket.io/ → Backend:5000 → Redis:6379
                      → /*          → Frontend:80
```

## Prérequis
- Docker Desktop installé et démarré
- Ports 80, 5000, 5432, 6379 libres

## Démarrage

### 1. Configurer les secrets (une seule fois)
Éditer `backend/.env.docker.local` avec vos vraies valeurs (déjà fait si vous avez le fichier).

### 2. Build et démarrage complet
```cmd
cd c:\e-commerce-parapharmacie
docker compose up --build -d
```

### 3. Vérifier que tout tourne
```cmd
docker compose ps
docker compose logs backend --tail=50
```

### 4. Tester
- Frontend : http://localhost
- API health : http://localhost/api/health

## Commandes utiles

```cmd
# Voir les logs en temps réel
docker compose logs -f

# Redémarrer un service
docker compose restart backend

# Arrêter tout
docker compose down

# Arrêter et supprimer les volumes (reset DB)
docker compose down -v

# Rebuild un seul service
docker compose up --build -d backend
```

## Mise à jour du code

```cmd
docker compose up --build -d backend
# ou frontend
docker compose up --build -d frontend
```
