# TODO: Fix Slider Promotions non affiché client

**Problème :** Slider vide sur '/' malgré promotions créées admin.

**Étapes de diagnostic (À faire) :**
- [ ] 1. Console navigateur → '/' → logs "🔍 Fetching promotions" + erreurs
- [ ] 2. Network tab → status/réponse `/api/promotions/active`
- [ ] 3. Admin → vérifier promotions : `active=true`, dates `start≤today≤end`
- [ ] 4. Backend logs → requêtes /promotions/active
- [ ] 5. DB → `prisma studio` → table Promotion

**Étapes fix (après logs) :**
- [ ] Corriger dates/active ou backend query
- [ ] Tester → slider visible avec promotions
