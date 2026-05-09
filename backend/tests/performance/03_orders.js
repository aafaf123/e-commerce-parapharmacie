// tests/performance/03_orders.js
// Endpoints commandes : création, consultation, annulation
// Lancer : k6 run tests/performance/03_orders.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const orderCreateDuration = new Trend('order_create_duration', true);
const orderListDuration   = new Trend('order_list_duration',   true);
const errorRate           = new Rate('error_rate');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5  },
        { duration: '1m',  target: 15 },
        { duration: '20s', target: 0  },
      ],
      startTime: '35s',
    },
  },
  thresholds: {
    http_req_duration:     ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:       ['rate<0.01'],
    checks:                ['rate>0.99'],
    order_create_duration: ['p(95)<1500'],
    order_list_duration:   ['p(95)<500'],
  },
};

// Setup : login pour obtenir un token + récupérer un produit
export function setup() {
  const headers = { 'Content-Type': 'application/json' };

  // Login client
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email:    __ENV.TEST_CLIENT_EMAIL    || 'client@test.com',
      password: __ENV.TEST_CLIENT_PASSWORD || 'Test1234!',
    }),
    { headers }
  );

  let clientToken = null;
  if (loginRes.status === 200) {
    clientToken = JSON.parse(loginRes.body).token;
  }

  // Login admin
  const adminRes = http.post(
    `${BASE_URL}/api/admin/login`,
    JSON.stringify({
      email:    __ENV.TEST_ADMIN_EMAIL    || 'admin@parapharmacie.ma',
      password: __ENV.TEST_ADMIN_PASSWORD || 'Admin1234!',
    }),
    { headers }
  );

  let adminToken = null;
  if (adminRes.status === 200) {
    adminToken = JSON.parse(adminRes.body).token;
  }

  // Récupérer un produit disponible
  const productsRes = http.get(`${BASE_URL}/api/products?limit=1&active=true`);
  let product = null;
  if (productsRes.status === 200) {
    const body = JSON.parse(productsRes.body);
    product = body.products?.[0] || null;
  }

  return { clientToken, adminToken, product };
}

export default function (data) {
  const { clientToken, adminToken, product } = data;

  if (!clientToken || !product) {
    console.warn('Setup incomplet — token ou produit manquant');
    sleep(2);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clientToken}`,
  };

  // ── 1. Créer une commande ────────────────────────────────────────────────
  let orderId = null;
  {
    const res = http.post(
      `${BASE_URL}/api/orders/create`,
      JSON.stringify({
        items: [{
          id:       product.id,
          name:     product.name,
          price:    product.price,
          quantity: 1,
        }],
        total:         product.price,
        paymentMethod: 'cash',
      }),
      { headers: authHeaders }
    );

    orderCreateDuration.add(res.timings.duration);
    errorRate.add(res.status !== 201);

    check(res, {
      'POST /orders/create — 201':          (r) => r.status === 201,
      'POST /orders/create — has order':    (r) => {
        try { return !!JSON.parse(r.body).order?.id; } catch { return false; }
      },
      'POST /orders/create — < 1500ms':     (r) => r.timings.duration < 1500,
    });

    if (res.status === 201) {
      try { orderId = JSON.parse(res.body).order.id; } catch {}
    }
  }

  sleep(0.5);

  // ── 2. Mes commandes ─────────────────────────────────────────────────────
  {
    const res = http.get(
      `${BASE_URL}/api/orders/my-orders`,
      { headers: authHeaders }
    );
    orderListDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /orders/my-orders — 200':     (r) => r.status === 200,
      'GET /orders/my-orders — < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(0.5);

  // ── 3. Détail commande ───────────────────────────────────────────────────
  if (orderId) {
    const res = http.get(
      `${BASE_URL}/api/orders/${orderId}`,
      { headers: authHeaders }
    );
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /orders/:id — 200':     (r) => r.status === 200,
      'GET /orders/:id — < 400ms': (r) => r.timings.duration < 400,
    });
  }

  sleep(0.5);

  // ── 4. Annuler la commande ───────────────────────────────────────────────
  if (orderId) {
    const res = http.put(
      `${BASE_URL}/api/orders/${orderId}/cancel`,
      null,
      { headers: authHeaders }
    );
    check(res, {
      'PUT /orders/:id/cancel — 200':     (r) => r.status === 200,
      'PUT /orders/:id/cancel — < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(0.5);

  // ── 5. Liste admin des commandes ─────────────────────────────────────────
  if (adminToken) {
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    };
    const res = http.get(
      `${BASE_URL}/api/admin/orders?page=1&limit=20`,
      { headers: adminHeaders }
    );
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/orders — 200':     (r) => r.status === 200,
      'GET /admin/orders — < 600ms': (r) => r.timings.duration < 600,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/03_orders_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT PERFORMANCE : 03 — Commandes                ║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Échecs        : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Durées globales (ms)
  p50           : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms

⏱  Création commande (ms)
  p95           : ${(m.order_create_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

⏱  Liste commandes (ms)
  p95           : ${(m.order_list_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

${(failed?.values?.rate ?? 0) < 0.01 ? '✅ SEUILS RESPECTÉS' : '❌ SEUILS DÉPASSÉS'}
`;
}
