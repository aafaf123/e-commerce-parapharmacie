import React from 'react'
import { ArrowLeft, Shield, Eye, Lock, Database, Mail, Phone, MapPin, Calendar, Users, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PrivacyPolicy = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sky-700 font-semibold mb-6 hover:text-sky-800 transition-colors"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-sky-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de Confidentialité</h1>
            <p className="text-gray-600">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-3">
                <Eye className="w-6 h-6 text-sky-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-sky-800 mb-2">Notre engagement</h3>
                  <p className="text-sky-700">
                    Nous nous engageons à protéger votre vie privée et à traiter vos données personnelles 
                    de manière transparente, conformément au RGPD et à la législation marocaine en vigueur.
                  </p>
                </div>
              </div>
            </div>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">1. Données collectées</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Informations personnelles
                  </h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Nom et prénom</li>
                    <li>Adresse email</li>
                    <li>Numéro de téléphone</li>
                    <li>Adresse de livraison</li>
                    <li>Numéro WhatsApp (optionnel)</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Données de commande
                  </h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Historique des commandes</li>
                    <li>Produits achetés</li>
                    <li>Montants des transactions</li>
                    <li>Créneaux de retrait choisis</li>
                    <li>Préférences de livraison</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Données techniques
                  </h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>Adresse IP</li>
                    <li>Type de navigateur</li>
                    <li>Pages visitées</li>
                    <li>Durée de navigation</li>
                    <li>Cookies de fonctionnement</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">2. Utilisation des données</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Finalités principales</h3>
                  <ul className="list-disc list-inside text-green-700 space-y-1 text-sm">
                    <li>Traitement des commandes</li>
                    <li>Gestion des livraisons</li>
                    <li>Service client</li>
                    <li>Facturation</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">Communications</h3>
                  <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                    <li>Confirmations de commande</li>
                    <li>Notifications de statut</li>
                    <li>Rappels de retrait</li>
                    <li>Offres personnalisées (avec consentement)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">3. Partage des données</h2>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <h3 className="font-semibold text-amber-800 mb-3">Nous ne vendons jamais vos données</h3>
                <p className="text-amber-700 mb-3">
                  Vos données peuvent être partagées uniquement dans les cas suivants :
                </p>
                <ul className="list-disc list-inside text-amber-700 space-y-1">
                  <li><strong>Prestataires de livraison</strong> : Pour assurer la livraison de vos commandes</li>
                  <li><strong>Processeurs de paiement</strong> : Pour sécuriser les transactions</li>
                  <li><strong>Obligations légales</strong> : Si requis par la loi marocaine</li>
                  <li><strong>Consentement explicite</strong> : Avec votre autorisation préalable</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">4. Sécurité des données</h2>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Lock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-gray-800 mb-1">Chiffrement</h3>
                  <p className="text-sm text-gray-600">SSL/TLS pour toutes les communications</p>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Database className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-gray-800 mb-1">Stockage sécurisé</h3>
                  <p className="text-sm text-gray-600">Serveurs protégés et sauvegardés</p>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Eye className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-gray-800 mb-1">Accès limité</h3>
                  <p className="text-sm text-gray-600">Personnel autorisé uniquement</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">5. Vos droits</h2>
              </div>
              
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-6">
                <p className="text-sky-800 mb-4 font-medium">
                  Conformément au RGPD, vous disposez des droits suivants :
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sky-700">
                      <Eye className="w-4 h-4" />
                      <span>Droit d'accès à vos données</span>
                    </li>
                    <li className="flex items-center gap-2 text-sky-700">
                      <FileText className="w-4 h-4" />
                      <span>Droit de rectification</span>
                    </li>
                    <li className="flex items-center gap-2 text-sky-700">
                      <Lock className="w-4 h-4" />
                      <span>Droit à l'effacement</span>
                    </li>
                  </ul>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sky-700">
                      <Shield className="w-4 h-4" />
                      <span>Droit à la portabilité</span>
                    </li>
                    <li className="flex items-center gap-2 text-sky-700">
                      <Mail className="w-4 h-4" />
                      <span>Droit d'opposition</span>
                    </li>
                    <li className="flex items-center gap-2 text-sky-700">
                      <Users className="w-4 h-4" />
                      <span>Droit de limitation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">6. Conservation des données</h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Données de compte actif</span>
                  <span className="text-gray-600">Durée de vie du compte</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Historique des commandes</span>
                  <span className="text-gray-600">10 ans (obligations comptables)</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Données de navigation</span>
                  <span className="text-gray-600">13 mois maximum</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-800">Compte supprimé</span>
                  <span className="text-gray-600">Suppression immédiate</span>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">7. Contact</h2>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-4">
                  Pour exercer vos droits ou pour toute question concernant cette politique :
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">privacy@parapharmacie.ma</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">+212 5 22 XX XX XX</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Casablanca, Maroc</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">8. Modifications</h2>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">
                  Cette politique peut être mise à jour pour refléter les changements dans nos pratiques 
                  ou la législation. Nous vous informerons de toute modification importante par email 
                  ou via une notification sur notre site.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy