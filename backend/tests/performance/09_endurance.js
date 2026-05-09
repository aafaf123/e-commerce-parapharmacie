// tests/performance/09_endurance.js
// Test d'endurance : 50 users pendant 10 minutes
// Détecte les fuites mémoire, dégradation progressive, connexions DB non fermées
// Lancer : k6 run --env BASE_URL=http://localhost:5000 backend/tests/performance/09_endurance.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Métriques par tranche de temps pour détecter la dégradation
const earlyDuration = new Trend('early_response_time',  true); // 0-3min
const midDuration   = new Trend('mid_response_time',    true); // 3-7min
const lateDuration  = new Trend('late_response_time',   true); // 7-10min
const errorRate     = new Rate('errors');

// Timestamp de début pour segmenter les métriques
let startTime;

export const options = {
  scenarios: {
    endurance: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
  },
  thresholds: {
    http_req_duration:   ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:     ['rate<0.02'],
    checks:              ['rate>0.98'],
    errors:              ['rate<0.02'],
    // La dégradation ne doit pas dépasser 50% entre début et fin
    early_response_time: ['p(95)<800'],
    late_response_time:  ['p(95)<1200'], // tolérance légère en fin de test
  },
};

export function setup() {
  startTime = Date.now();

  const res = http.get(`${BASE_URL}/api/products?limit=5`);
  let products = [];
  if (res.status === 200) {
    products = JSON.parse(res.body).products || [];
  }
  return { products, startTime: Date.now() };
}

export default function (data) {
  const { products } = data;
  const elapsed = (Date.now() - data.startTime) / 1000; // secondes écoulées

  // ── Requêtes représentatives du trafic normal ────────────────────────────

  // 1. Health check (indicateur de disponibilité)
  const r1 = http.get(`${BASE_URL}/api/health`);
  const ok1 = check(r1, { 'health 200': (r) => r.status === 200 });
  errorRate.add(!ok1);
  trackDuration(r1.timings.duration, elapsed);

  sleep(0.2);

  // 2. Liste produits
  const r2 = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  const ok2 = check(r2, { 'products 200': (r) => r.status === 200 });
  errorRate.add(!ok2);
  trackDuration(r2.timings.duration, elapsed);

  sleep(0.3);

  // 3. Catégories
  const r3 = http.get(`${BASE_URL}/api/categories`);
  check(r3, { 'categories 200': (r) => r.status === 200 });
  trackDuration(r3.timings.duration, elapsed);

  sleep(0.3);

  // 4. Fiche produit (rotation sur les produits disponibles)
  if (products.length > 0) {
    const p = products[__ITER % products.length];
    const r4 = http.get(`${BASE_URL}/api/products/${p.id}`);
    const ok4 = check(r4, { 'product detail 200': (r) => r.status === 200 });
    errorRate.add(!ok4);
    trackDuration(r4.timings.duration, elapsed);
  }

  sleep(0.5);

  // 5. Recherche (charge DB)
  const terms = ['creme', 'serum', 'vitamine', 'solaire'];
  const term  = terms[__ITER % terms.length];
  const r5 = http.get(`${BASE_URL}/api/products?search=${term}&limit=10`);
  check(r5, { 'search 200': (r) => r.status === 200 });
  trackDuration(r5.timings.duration, elapsed);

  sleep(1);
}

// Segmente les durées par tranche de temps
function trackDuration(duration, elapsedSeconds) {
  const minutes = elapsedSeconds / 60;
  if (minutes < 3) {
    earlyDuration.add(duration);
  } else if (minutes < 7) {
    midDuration.add(duration);
  } else {
    lateDuration.add(duration);
  }
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/09_endurance_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m   = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  const earlyP95 = m.early_response_time?.values?.['p(95)'] ?? 0;
  const midP95   = m.mid_response_time?.values?.['p(95)']   ?? 0;
  const lateP95  = m.late_response_time?.values?.['p(95)']  ?? 0;

  // Calcul de la dégradation
  const degradation = earlyP95 > 0 ? ((lateP95 - earlyP95) / earlyP95 * 100) : 0;

  let degradationVerdict;
  if (degradation < 10) {
    degradationVerdict = '✅ Aucune dégradation détectée';
  } else if (degradation < 30) {
    degradationVerdict = '⚠️  Légère dégradation (possible fuite mémoire)';
  } else {
    degradationVerdict = '❌ Dégradation significative — fuite mémoire probable';
  }

  return `
╔══════════════════════════════════════════════════════════════╗
║  RAPPORT : 09 — TEST D'ENDURANCE (50 users × 10 minutes)   ║
╚══════════════════════════════════════════════════════════════╝

📊 Volume total
  Requêtes          : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit moyen       : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Taux d'erreur     : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Temps de réponse global (ms)
  p50               : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95               : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99               : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms

📈 Évolution des temps de réponse (p95)
  0-3 min (début)   : ${earlyP95.toFixed(0)}ms
  3-7 min (milieu)  : ${midP95.toFixed(0)}ms
  7-10 min (fin)    : ${lateP95.toFixed(0)}ms
  Dégradation       : ${degradation > 0 ? '+' : ''}${degradation.toFixed(1)}%

🔍 Analyse dégradation : ${degradationVerdict}

💡 Si la dégradation > 30% :
   - Vérifier les connexions Prisma non fermées
   - Vérifier les fuites mémoire Node.js (--inspect)
   - Vérifier le pool de connexions PostgreSQL
`;
}
