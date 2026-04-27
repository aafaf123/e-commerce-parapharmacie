# 📋 Modifications Bons de Commande Fournisseurs

## 🎯 Changements Implémentés

### 1. **Statuts Simplifiés**
- ✅ **BROUILLON** : Commande en cours de création
- ✅ **ENVOYÉ** : Commande envoyée au fournisseur  
- ✅ **VALIDÉ** : Commande livrée et validée

*Anciens statuts supprimés : VALIDATION_ATTENTE, REÇU_PARTIEL, REÇU_TOTAL, ANNULÉ*

### 2. **Actions Nettoyées**
- ❌ Suppression du bouton "Test Email"
- ✅ Bouton "Confirmer réception" masqué si commande déjà livrée
- ✅ Actions contextuelles selon le statut

### 3. **Nouvelles Colonnes**
- 📅 **Date Prévue** : Date de livraison attendue
- 📅 **Date Réelle** : Date de réception effective

### 4. **Indicateurs Visuels** 🚨
- ⚠️ **Livraison prévue dépassée** (orange)
- 🔔 **Facture non reçue** (rouge) - après 7 jours
- ⏰ **Paiement en retard** (rouge foncé) - après 30 jours

### 5. **Détail Accordéon** 📖
Au clic sur une commande :
- 📦 Liste des produits avec quantités
- 💰 Prix unitaires convenus
- ✅ Quantités reçues vs manquantes
- 💬 Historique des échanges internes

### 6. **Export PDF Trimestriel** 📄
- 📊 Rapport par trimestre (ex: 2024-Q1)
- 📈 Totaux et statistiques
- 🖨️ Prêt pour impression

## 🔧 Installation

1. **Appliquer les changements :**
   ```bash
   cd backend
   npm run db:push
   node migrate-purchase-orders.js
   ```

2. **Ou utiliser le script automatique :**
   ```bash
   apply-purchase-order-changes.bat
   ```

## 📊 Structure des Données

### Modèle PurchaseOrder Mis à Jour
```prisma
model PurchaseOrder {
  id              String    @id @default(uuid())
  orderNumber     String    @unique
  supplierId      String
  status          String    @default("BROUILLON") // BROUILLON, ENVOYÉ, VALIDÉ
  totalAmount     Float     @default(0)
  discountAmount  Float     @default(0)
  paidAmount      Float     @default(0)
  notes           String?   @db.Text
  orderDate       DateTime  @default(now())
  sentDate        DateTime? // 🆕 Date d'envoi
  expectedDate    DateTime? // 🆕 Date prévue
  receivedDate    DateTime? // 🆕 Date réelle
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations...
}
```

## 🎨 Interface Utilisateur

### Tableau Principal
- 📋 Colonnes : N° Commande, Fournisseur, Date, Date Prévue, Date Réelle, Total, Statut, Actions
- 🔍 Filtres par statut simplifiés
- 📤 Export PDF trimestriel
- ⚠️ Indicateurs visuels d'alerte

### Détail Accordéon
- 🔽 Clic pour développer/réduire
- 📦 Tableau des produits détaillé
- 📝 Historique chronologique des actions
- 💬 Notes et commentaires

## 🚀 Fonctionnalités

### Workflow Simplifié
1. **BROUILLON** → Création et modification
2. **ENVOYÉ** → Envoi au fournisseur (+ email automatique)
3. **VALIDÉ** → Réception confirmée (+ mise à jour stock)

### Alertes Automatiques
- 🟠 Livraison en retard (date prévue dépassée)
- 🔴 Facture non reçue (>7 jours après envoi)
- 🔴 Paiement en retard (>30 jours après réception)

### Export & Reporting
- 📊 Export PDF par trimestre
- 📈 Statistiques automatiques
- 🖨️ Format prêt pour impression

## 🔄 Migration des Données

Le script `migrate-purchase-orders.js` convertit automatiquement :
- `VALIDATION_ATTENTE` → `BROUILLON`
- `REÇU_TOTAL` → `VALIDÉ`
- `REÇU_PARTIEL` → `ENVOYÉ`
- `ANNULÉ` → `BROUILLON`

## ✅ Tests Recommandés

1. ✅ Créer un nouveau bon de commande
2. ✅ Envoyer au fournisseur
3. ✅ Confirmer la réception
4. ✅ Vérifier les indicateurs d'alerte
5. ✅ Tester l'accordéon de détail
6. ✅ Exporter un rapport PDF trimestriel

---

**Status : ✅ Prêt pour production**