import re

fpath = 'frontend/src/pages/AdminPromotions.jsx'
with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# 1. Supprimer les blocs "const t = (key...) => { const map = {...}; return map[key]||key; };"
# On les remplace par rien (bloc complet)
content = re.sub(
    r'[ \t]*//[^\n]*[Tt]raductions?[^\n]*\n[ \t]*const t = \(key[^)]*\) => \{[\s\S]*?return map\[key\] \|\| key;\s*\};\s*',
    '',
    content
)

# 2. Supprimer les lignes d'import react-i18next
content = re.sub(r"^.*import.*useTranslation.*from.*react-i18next.*\n", '', content, flags=re.MULTILINE)

# 3. Supprimer les lignes de déclaration const { t } = useTranslation() et variantes
content = re.sub(r"^[ \t]*const \{ t(?:, i18n)? \} = useTranslation\(\);?\s*\n", '', content, flags=re.MULTILINE)
content = re.sub(r"^[ \t]*const \{ i18n(?:, t)? \} = useTranslation\(\);?\s*\n", '', content, flags=re.MULTILINE)

# 4. Supprimer les lignes const isAr = i18n.language...
content = re.sub(r"^[ \t]*const isAr = i18n\.language.*\n", '', content, flags=re.MULTILINE)

# 5. Remplacer i18n.language?.startsWith('ar') ? '...' : '...' par la version française
content = re.sub(r"i18n\.language\?\.startsWith\('ar'\)\s*\?\s*'[^']*'\s*:\s*'([^']*)'", r"'\1'", content)

# 6. Remplacer t('clé') dans le JSX par du texte statique
# Map de toutes les clés connues
replacements = {
    "t('admin_promotions.promo_created')": "'Promotion créée avec succès.'",
    "t('admin_promotions.promo_updated')": "'Promotion mise à jour.'",
    "t('admin_promotions.status_updated')": "'Statut mis à jour.'",
    "t('admin_promotions.delete_promo_confirm')": "'Supprimer cette promotion ?'",
    "t('admin_promotions.promo_deleted')": "'Promotion supprimée.'",
    "t('admin_promotions.code_created')": "'Code promo créé.'",
    "t('admin_promotions.code_updated')": "'Code promo mis à jour.'",
    "t('admin_promotions.delete_code_confirm')": "'Supprimer ce code promo ?'",
    "t('admin_promotions.code_deleted')": "'Code promo supprimé.'",
    "t('admin_promotions.copied')": "'Copié !'",
    "t('admin_promotions.title')": "'Promotions'",
    "t('admin_promotions.subtitle')": "'Gérez vos promotions et codes promo'",
    "t('admin_promotions.tab_codes')": "'Codes promo'",
    "t('admin_promotions.tab_banners')": "'Bannières'",
    "t('admin_promotions.tab_history')": "'Historique'",
    "t('admin_promotions.all')": "'Tous'",
    "t('admin_promotions.active')": "'Actif'",
    "t('admin_promotions.inactive')": "'Inactif'",
    "t('admin_promotions.search')": "'Rechercher...'",
    "t('admin_promotions.new_code')": "'Nouveau code'",
    "t('admin_promotions.new_banner')": "'Nouvelle bannière'",
    "t('admin_promotions.discount')": "'Remise'",
    "t('admin_promotions.type')": "'Type'",
    "t('admin_promotions.global')": "'Global'",
    "t('admin_promotions.product_type')": "'Produit'",
    "t('admin_promotions.category_type')": "'Catégorie'",
    "t('admin_promotions.usages')": "'Utilisations'",
    "t('admin_promotions.expiry')": "'Expiration'",
    "t('admin_promotions.no_limit')": "'Sans limite'",
    "t('admin_promotions.min_amount')": "'Min :'",
    "t('admin_promotions.active_btn')": "'Actif'",
    "t('admin_promotions.inactive_btn')": "'Inactif'",
    "t('admin_promotions.prev')": "'Précédent'",
    "t('admin_promotions.next')": "'Suivant'",
    "t('admin_promotions.reduction')": "'de réduction'",
    "t('admin_promotions.in_progress')": "'En cours'",
    "t('admin_promotions.upcoming')": "'À venir'",
    "t('admin_promotions.disabled')": "'Désactivée'",
    "t('admin_promotions.start')": "'Début'",
    "t('admin_promotions.end')": "'Fin'",
    "t('admin_promotions.product')": "'Produit'",
    "t('admin_promotions.all_products')": "'Tous les produits'",
    "t('admin_promotions.order')": "'Ordre'",
    "t('admin_promotions.activated')": "'Activée'",
    "t('admin_promotions.deactivated')": "'Désactivée'",
    "t('admin_promotions.impressions')": "'Impressions'",
    "t('admin_promotions.clicks')": "'Clics'",
    "t('admin_promotions.conversions')": "'Conversions'",
    "t('admin_promotions.total_discount')": "'Remise totale'",
    "t('admin_promotions.orders')": "'Commandes'",
    "t('admin_promotions.history_all')": "'Toutes'",
    "t('admin_promotions.history_active')": "'Actives'",
    "t('admin_promotions.history_expired')": "'Expirées'",
    "t('admin_promotions.history_scheduled')": "'Programmées'",
    "t('admin_promotions.no_history')": "'Aucune promotion dans l\\'historique.'",
    "t('admin_promotions.status_active')": "'Active'",
    "t('admin_promotions.status_expired')": "'Expirée'",
    "t('admin_promotions.status_scheduled')": "'Programmée'",
    "t('admin_promotions.status_inactive')": "'Inactive'",
    "t('admin_promotions.from')": "'Du'",
    "t('admin_promotions.to')": "'Au'",
    "t('admin_promotions.created_at')": "'Créé le'",
    "t('admin_promotions.live_preview')": "'Aperçu en direct'",
    "t('admin_promotions.clients_will_see')": "'Aperçu tel que vu par les clients'",
    "t('admin_promotions.no_image')": "'Aucune image'",
    "t('admin_promotions.default_badge')": "'Badge'",
    "t('admin_promotions.promo_default_title')": "'Titre de la promotion'",
    "t('admin_promotions.dates_not_defined')": "'Dates non définies'",
    "t('admin_promotions.modal_edit_promo')": "'Modifier la promotion'",
    "t('admin_promotions.modal_create_promo')": "'Nouvelle promotion'",
    "t('admin_promotions.form_tab')": "'Formulaire'",
    "t('admin_promotions.preview_tab')": "'Aperçu'",
    "t('admin_promotions.promo_image')": "'Image de la promotion'",
    "t('admin_promotions.uploading')": "'Envoi...'",
    "t('admin_promotions.choose_image')": "'Choisir une image'",
    "t('admin_promotions.image_hint')": "'Format recommandé : 800x400px'",
    "t('admin_promotions.title_field')": "'Titre'",
    "t('admin_promotions.subtitle_field')": "'Sous-titre'",
    "t('admin_promotions.description_field')": "'Description'",
    "t('admin_promotions.badge_field')": "'Badge'",
    "t('admin_promotions.badge_color')": "'Couleur du badge'",
    "t('admin_promotions.promo_price')": "'Prix promo (DH)'",
    "t('admin_promotions.old_price')": "'Ancien prix (DH)'",
    "t('admin_promotions.start_date')": "'Date de début'",
    "t('admin_promotions.end_date')": "'Date de fin'",
    "t('admin_promotions.start_end_required')": "'Dates de début et fin requises.'",
    "t('admin_promotions.calculated_discount_rate')": "'Taux de remise calculé :'",
    "t('admin_promotions.fill_prices_hint')": "'Renseignez les deux prix pour calculer la remise.'",
    "t('admin_promotions.features_field')": "'Avantages (séparés par virgule)'",
    "t('admin_promotions.cta_field')": "'Texte du bouton'",
    "t('admin_promotions.bg_color')": "'Couleur de fond'",
    "t('admin_promotions.display_order')": "'Ordre d\\'affichage'",
    "t('admin_promotions.promo_active')": "'Promotion active'",
    "t('admin_promotions.cancel')": "'Annuler'",
    "t('admin_promotions.update')": "'Mettre à jour'",
    "t('admin_promotions.create')": "'Créer'",
    "t('catalogue.enjoy_now')": "'Profiter maintenant'",
    "t('admin_promotions.code_field')": "'Code promo'",
    "t('admin_promotions.value_field')": "'Valeur'",
    "t('admin_promotions.modal_edit_code')": "'Modifier le code'",
    "t('admin_promotions.modal_create_code')": "'Nouveau code promo'",
    "t('admin_promotions.discount_type')": "'Type de remise'",
    "t('admin_promotions.percentage')": "'Pourcentage (%)'",
    "t('admin_promotions.fixed_amount')": "'Montant fixe (DH)'",
    "t('admin_promotions.min_purchase')": "'Achat minimum (DH)'",
    "t('admin_promotions.max_discount')": "'Remise maximale (DH)'",
    "t('admin_promotions.max_discount_placeholder')": "'Illimité'",
    "t('admin_promotions.usage_limit')": "'Limite d\\'utilisation'",
    "t('admin_promotions.unlimited')": "'Illimité'",
    "t('admin_promotions.expiry_date')": "'Date d\\'expiration'",
    "t('admin_promotions.applicable_on')": "'Applicable sur'",
    "t('admin_promotions.all_order')": "'Toute la commande'",
    "t('admin_promotions.specific_category')": "'Catégorie spécifique'",
    "t('admin_promotions.product_specific')": "'Produit spécifique'",
    "t('admin_promotions.code_active')": "'Code actif'",
    "t('admin_promotions.create_code_btn')": "'Créer le code'",
}

for key, val in replacements.items():
    content = content.replace(key, val)

# Remplacements avec paramètres dynamiques
content = re.sub(
    r"t\('admin_promotions\.showing',\s*\{[^}]+\}\)",
    r"``",
    content
)
content = re.sub(
    r"t\('admin_promotions\.only_left',\s*\{\s*n:\s*([^}]+)\}\)",
    r"'Plus que ' + \1 + ' !'",
    content
)
content = re.sub(
    r"t\('admin_promotions\.old_price_hint',\s*\{[^}]+\}\)",
    r"'Ancien : ' + parseFloat(formData.oldPrice).toFixed(2) + ' DH → Nouveau : ' + parseFloat(formData.price).toFixed(2) + ' DH'",
    content
)
content = re.sub(
    r"t\(`admin_purchase_orders\.\$\{[^}]+\}`\)",
    r"status",
    content
)

with open(fpath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
