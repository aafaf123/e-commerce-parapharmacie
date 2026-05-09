// tests/performance/config.js
// Configuration partagée pour tous les tests de performance

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Seuils globaux acceptables pour une parapharmacie e-commerce
export const THRESHOLDS = {
  // 95% des requêtes < 500ms, 99% < 1s
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // Taux d'erreur < 1%
  http_req_failed: ['rate<0.01'],
  // Taux de succès > 99%
  checks: ['rate>0.99'],
};

// Scénarios de charge réutilisables
export const SCENARIOS = {
  // Test de fumée : 1 utilisateur, 30s — vérifie que tout fonctionne
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  // Test de charge normale : montée progressive jusqu'à 20 users
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },  // montée
      { duration: '1m',  target: 20 },  // charge stable
      { duration: '20s', target: 0 },   // descente
    ],
  },
  // Test de stress : pousse jusqu'à la limite
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '1m',  target: 50 },
      { duration: '30s', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
  // Test de pic : spike soudain
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 5 },
      { duration: '5s',  target: 100 }, // pic brutal
      { duration: '10s', target: 5 },
      { duration: '10s', target: 0 },
    ],
  },
};

// Headers communs
export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Vérification standard d'une réponse HTTP
// Note: importer { check } from 'k6' dans le fichier appelant
export function checkResponse(checkFn, res, name, expectedStatus = 200) {
  return checkFn(res, {
    [`${name} — status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} — durée < 500ms`]:            (r) => r.timings.duration < 500,
    [`${name} — body non vide`]:            (r) => r.body && r.body.length > 0,
  });
}
