// tests/performance/04_admin_dashboard.js
// Dashboard admin : KPIs, rapports, stock, utilisateurs
// Lancer : k6 run tests/performance/04_admin_dashboard.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const kpiDuration     = new Trend('kpi_duration',     true);
const reportDuration  = new Trend('report_duration',  true);
const errorRate       = new Rate('error_rate');

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
        { duration: '20s', target: 5  },
        { duration: '40s', target: 10 },
        { duration: '20s', target: 0  },
      ],
      startTime: '35s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:   ['rate<0.01'],
    checks:            ['rate>0.99'],
    kpi_duration:      ['p(95)<800'],
    report_duration:   ['p(95)<1500'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/admin/login`,
    JSON.stringify({
      email:    __ENV.TEST_ADMIN_EMAIL    || 'admin@parapharmacie.ma',
      password: __ENV.TEST_ADMIN_PASSWORD || 'Admin1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 200) {
    console.error('Login admin échoué:', res.status, res.body);
    return { adminToken: null };
  }

  return { adminToken: JSON.parse(res.body).token };
}

export default function (data) {
  const { adminToken } = data;

  if (!adminToken) {
    console.warn('Pas de token admin — test ignoré');
    sleep(2);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  };

  // ── 1. KPIs dashboard ────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/kpis`, { headers });
    kpiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/kpis — 200':          (r) => r.status === 200,
      'GET /admin/kpis — has revenue':  (r) => {
        try { return JSON.parse(r.body).dailyRevenue !== undefined; } catch { return false; }
      },
      'GET /admin/kpis — < 800ms':      (r) => r.timings.duration < 800,
    });
  }

  sleep(0.5);

  // ── 2. Rapport ventes ────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/reports/sales`, { headers });
    reportDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/reports/sales — 200':     (r) => r.status === 200,
      'GET /admin/reports/sales — < 1500ms': (r) => r.timings.duration < 1500,
    });
  }

  sleep(0.5);

  // ── 3. Rapport produits ──────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/reports/products`, { headers });
    reportDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/reports/products — 200':      (r) => r.status === 200,
      'GET /admin/reports/products — < 1500ms': (r) => r.timings.duration < 1500,
    });
  }

  sleep(0.5);

  // ── 4. Stock faible ──────────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/low-stock-products?threshold=10`, { headers });
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/low-stock — 200':     (r) => r.status === 200,
      'GET /admin/low-stock — < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(0.5);

  // ── 5. Liste utilisateurs ────────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/users?page=1&limit=20`, { headers });
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/users — 200':     (r) => r.status === 200,
      'GET /admin/users — < 600ms': (r) => r.timings.duration < 600,
    });
  }

  sleep(0.5);

  // ── 6. Liste commandes admin ─────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/orders?page=1&limit=20`, { headers });
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/orders — 200':     (r) => r.status === 200,
      'GET /admin/orders — < 600ms': (r) => r.timings.duration < 600,
    });
  }

  sleep(0.5);

  // ── 7. Notifications non lues ────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/admin/notifications/unread-count`, { headers });
    errorRate.add(res.status !== 200);

    check(res, {
      'GET /admin/notifications/unread-count — 200':     (r) => r.status === 200,
      'GET /admin/notifications/unread-count — < 300ms': (r) => r.timings.duration < 300,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/04_admin_dashboard_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT PERFORMANCE : 04 — Dashboard Admin          ║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Échecs        : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Durées globales (ms)
  p50           : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms

⏱  KPIs (ms)
  p95           : ${(m.kpi_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

⏱  Rapports (ms)
  p95           : ${(m.report_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

${(failed?.values?.rate ?? 0) < 0.01 ? '✅ SEUILS RESPECTÉS' : '❌ SEUILS DÉPASSÉS'}
`;
}
