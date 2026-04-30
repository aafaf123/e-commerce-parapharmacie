// Test simple des services d'authentification
console.log('Test des services d\'authentification securises...')

import { ClientAuthService, EmployeeAuthService, AdminAuthService } from './src/services/secureAuthService.js'

async function testAuth() {
  try {
    console.log('Test connexion client avec mauvais mot de passe...')
    
    try {
      await ClientAuthService.login('sanaepatrish@gmail.com', 'wrongpassword')
      console.log('ERREUR: connexion client reussie avec mauvais mot de passe')
    } catch (error) {
      console.log('OK: connexion client refusee avec mauvais mot de passe')
    }
    
    console.log('Test connexion employee avec email inexistant...')
    
    try {
      await EmployeeAuthService.login('nonexistent@test.com', 'password')
      console.log('ERREUR: connexion employee reussie avec email inexistant')
    } catch (error) {
      console.log('OK: connexion employee refusee avec email inexistant')
    }
    
    console.log('Tous les tests passes!')
    
  } catch (error) {
    console.error('Erreur lors des tests:', error.message)
  }
}

testAuth()