// tests/performance/08_spike_promo_flash.js
// Test de pic : simulation d'une promotion flash
// 200 users arrivent brutalement en 10 secondes (ex: email promo envoyé)
// Lancer : k6 run --env BASE_URL=http://localhost:5000 backend/tests/performance/08_spike_promo_flash.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

const errorRate   = new Rate('errors');
const spikeDur    = new Trend('spike_response_time', true);

export const options = {
  scenarios: {
    promo_flash_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10  }, // trafic normal
        { duration: '10s', target: 200 }, // PIC BRUTAL — email promo envoyé
        { duration: '2m',  target: 200 }, // maintien du pic
        { duration: '30s', target: 10  }, // retour normal
        { duration: '20s', target: 0   },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:   ['rate<0.10'],  // 10% toléré pendant le pic
    checks:            ['rate>0.90'],
    errors:            ['rate<0.10'],
    spike_response_time: ['p(95)<2000'],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/products?limit=5`);
  let products = [];
  if (res.status === 200) {
    products = JSON.parse(res.body).products || [];
  }
  return { products };
}

export default function (data) {
  const { products } = data;

  // Comportement typique lors d'une promo flash :
  // tous les users regardent les promos et les produits en même temps

  // 1. Page promotions (endpoint le plus sollicité lors d'une promo)
  const r1 = http.get(`${BASE_URL}/api/promotions/active`);
  spikeDur.add(r1.timings.duration);
  const ok1 = check(r1, {
    'promotions active — répond':    (r) => r.status === 200,
    'promotions active — < 2000ms':  (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok1);

  sleep(0.2);

  // 2. Liste produits (tous cherchent les produits en promo)
  const r2 = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  spikeDur.add(r2.timings.duration);
  const ok2 = check(r2, {
    'products list — répond':   (r) => r.status === 200,
    'products list — < 2000ms': (r) => r.timings.duration < 2000,
  });
  errorRate.add(!ok2);

  sleep(0.2);

  // 3. Fiche produit (les plus rapides cliquent sur un produit)
  if (products.length > 0 && Math.random() > 0.3) {
    const p = products[Math.floor(Math.random() * products.length)];
    const r3 = http.get(`${BASE_URL}/api/products/${p.id}`);
    spikeDur.add(r3.timings.duration);
    check(r3, {
      'product detail — répond':   (r) => r.status === 200,
      'product detail — < 2000ms': (r) => r.timings.duration < 2000,
    });
  }

  sleep(0.3);

  // 4. Health check (vérifie que l'API reste disponible sous le pic)
  const r4 = http.get(`${BASE_URL}/api/health`);
  const okHealth = check(r4, {
    'health — toujours disponible': (r) => r.status === 200,
  });
  errorRate.add(!okHealth);

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/08_spike_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m   = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  const p95    = dur?.values?.['p(95)'] ?? 0;
  const errPct = (failed?.values?.rate ?? 0) * 100;

  let verdict;
  if (errPct < 5 && p95 < 1000) {
    verdict = '✅ EXCELLENT — L\'API absorbe le pic sans dégradation';
  } else if (errPct < 10 && p95 < 2000) {
    verdict = '⚠️  ACCEPTABLE — Légère dégradation pendant le pic';
  } else {
    verdict = '❌ CRITIQUE — L\'API est saturée pendant le pic';
  }

  return `
╔══════════════════════════════════════════════════════════════╗
║  RAPPORT : 08 — SPIKE TEST (Promotion Flash 200 users)      ║
╚══════════════════════════════════════════════════════════════╝

📊 Volume
  Requêtes totales  : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit max         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Taux d'erreur     : ${errPct.toFixed(2)}%

⏱  Temps de réponse pendant le pic (ms)
  p50               : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95               : ${p95.toFixed(0)}ms
  p99               : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms
  Max               : ${(dur?.values?.max ?? 0).toFixed(0)}ms

⏱  Spike response time (p95) : ${(m.spike_response_time?.values?.['p(95)'] ?? 0).toFixed(0)}ms

🏁 VERDICT : ${verdict}

💡 Ce test simule l'envoi d'un email promotionnel à tous les clients.
   Un pic brutal de 200 users en 10 secondes est réaliste pour
   une parapharmacie avec ~2000 clients actifs.
`;
}
