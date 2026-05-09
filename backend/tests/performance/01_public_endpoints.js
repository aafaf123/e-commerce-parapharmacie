// tests/performance/01_public_endpoints.js
// Endpoints publics : produits, catégories, promotions
// Lancer : k6 run tests/performance/01_public_endpoints.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Métriques personnalisées
const productListDuration  = new Trend('product_list_duration',  true);
const categoryListDuration = new Trend('category_list_duration', true);
const productDetailDuration = new Trend('product_detail_duration', true);
const errorRate = new Rate('error_rate');
const requestCount = new Counter('total_requests');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 20 },
        { duration: '20s', target: 0 },
      ],
      startTime: '35s', // démarre après smoke
      tags: { scenario: 'load' },
    },
  },
  thresholds: {
    http_req_duration:       ['p(95)<500', 'p(99)<1000'],
    http_req_failed:         ['rate<0.01'],
    checks:                  ['rate>0.99'],
    product_list_duration:   ['p(95)<400'],
    category_list_duration:  ['p(95)<300'],
    product_detail_duration: ['p(95)<400'],
  },
};

// Récupère un productId réel au setup
export function setup() {
  const res = http.get(`${BASE_URL}/api/products?limit=5`);
  if (res.status !== 200) return { productId: null, categoryId: null };

  const body = JSON.parse(res.body);
  const products = body.products || [];
  const productId = products.length > 0 ? products[0].id : null;
  const categoryId = products.length > 0 ? products[0].categoryId : null;
  return { productId, categoryId };
}

export default function (data) {
  const { productId, categoryId } = data;

  // ── 1. Liste des produits ────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
    requestCount.add(1);
    productListDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /products — 200':       (r) => r.status === 200,
      'GET /products — a products': (r) => {
        try { return JSON.parse(r.body).products !== undefined; } catch { return false; }
      },
      'GET /products — < 500ms':   (r) => r.timings.duration < 500,
    });
  }

  sleep(0.5);

  // ── 2. Produits filtrés par catégorie ────────────────────────────────────
  if (categoryId) {
    const res = http.get(`${BASE_URL}/api/products?categoryId=${categoryId}&limit=10`);
    requestCount.add(1);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /products?categoryId — 200':     (r) => r.status === 200,
      'GET /products?categoryId — < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(0.3);

  // ── 3. Recherche produits ────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/products?search=creme&limit=10`);
    requestCount.add(1);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /products?search — 200':     (r) => r.status === 200,
      'GET /products?search — < 600ms': (r) => r.timings.duration < 600,
    });
  }

  sleep(0.3);

  // ── 4. Détail produit ────────────────────────────────────────────────────
  if (productId) {
    const res = http.get(`${BASE_URL}/api/products/${productId}`);
    requestCount.add(1);
    productDetailDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /products/:id — 200':     (r) => r.status === 200,
      'GET /products/:id — has id':  (r) => {
        try { return JSON.parse(r.body).id === productId; } catch { return false; }
      },
      'GET /products/:id — < 400ms': (r) => r.timings.duration < 400,
    });
  }

  sleep(0.5);

  // ── 5. Liste des catégories ──────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/categories`);
    requestCount.add(1);
    categoryListDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /categories — 200':     (r) => r.status === 200,
      'GET /categories — < 300ms': (r) => r.timings.duration < 300,
    });
  }

  sleep(0.5);

  // ── 6. Promotions actives ────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/promotions/active`);
    requestCount.add(1);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /promotions/active — 200':     (r) => r.status === 200,
      'GET /promotions/active — < 400ms': (r) => r.timings.duration < 400,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/01_public_endpoints_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data, '01 — Endpoints Publics'),
  };
}

function formatSummary(data, title) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;
  const checks = m.checks;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT PERFORMANCE : ${title.padEnd(28)}║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Échecs        : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Durées (ms)
  Médiane (p50) : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p90           : ${(dur?.values?.['p(90)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms
  Max           : ${(dur?.values?.max ?? 0).toFixed(0)}ms

✅ Checks
  Réussis       : ${((checks?.values?.rate ?? 0) * 100).toFixed(2)}%

${(failed?.values?.rate ?? 0) < 0.01 ? '✅ SEUILS RESPECTÉS' : '❌ SEUILS DÉPASSÉS'}
`;
}
