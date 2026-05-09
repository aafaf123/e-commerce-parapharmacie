// tests/performance/06_stress.js
// Test de stress : trouve le point de rupture de l'API
// Lancer : k6 run tests/performance/06_stress.js
// ⚠️  À lancer uniquement hors production

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const errorRate    = new Rate('error_rate');
const responsetime = new Trend('response_time', true);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10  }, // normal
        { duration: '30s', target: 30  }, // charge élevée
        { duration: '30s', target: 60  }, // stress
        { duration: '30s', target: 100 }, // limite
        { duration: '30s', target: 0   }, // récupération
      ],
    },
  },
  // Seuils plus souples pour le stress test
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.10'],  // 10% d'erreurs acceptées sous stress
    checks:            ['rate>0.90'],
  },
};

export default function () {
  // Uniquement les endpoints les plus sollicités
  const endpoints = [
    { url: `${BASE_URL}/api/products?page=1&limit=20`,  name: 'products_list'  },
    { url: `${BASE_URL}/api/categories`,                name: 'categories'     },
    { url: `${BASE_URL}/api/promotions/active`,         name: 'promotions'     },
    { url: `${BASE_URL}/api/health`,                    name: 'health'         },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(endpoint.url, { tags: { endpoint: endpoint.name } });

  responsetime.add(res.timings.duration, { endpoint: endpoint.name });
  errorRate.add(res.status >= 500);

  check(res, {
    [`${endpoint.name} — pas d'erreur 5xx`]: (r) => r.status < 500,
    [`${endpoint.name} — répond`]:           (r) => r.status > 0,
  });

  sleep(0.1); // Très peu de pause pour maximiser la charge
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/06_stress_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT STRESS TEST : 06 — Point de rupture         ║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit max     : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Erreurs 5xx   : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Durées (ms)
  p50           : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p90           : ${(dur?.values?.['p(90)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms
  Max           : ${(dur?.values?.max ?? 0).toFixed(0)}ms

💡 Interprétation :
  - Si p95 < 500ms  → Excellent
  - Si p95 < 1000ms → Acceptable
  - Si p95 > 2000ms → Optimisation nécessaire
  - Si erreurs > 5% → Point de rupture atteint

${(failed?.values?.rate ?? 0) < 0.10 ? '✅ API STABLE SOUS STRESS' : '⚠️  POINT DE RUPTURE ATTEINT'}
`;
}
