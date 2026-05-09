// tests/performance/07_load_200_users.js
// Test de charge : 200 utilisateurs simultanés
// Simule la charge maximale attendue sur l'application
// Lancer : k6 run --env BASE_URL=http://localhost:5000 --env TEST_EMAIL=admin@parapharmacie.ma --env TEST_PASSWORD=Admin1234! backend/tests/performance/07_load_200_users.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Métriques personnalisées
const errorRate        = new Rate('errors');
const successRate      = new Rate('successes');
const publicDuration   = new Trend('public_endpoint_duration',  true);
const authDuration     = new Trend('auth_endpoint_duration',    true);
const orderDuration    = new Trend('order_endpoint_duration',   true);
const totalRequests    = new Counter('total_requests');

export const options = {
  scenarios: {
    // Montée progressive jusqu'à 200 users
    ramp_to_200: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 50  }, // montée douce : 0 → 50
        { duration: '2m',  target: 100 }, // montée : 50 → 100
        { duration: '2m',  target: 200 }, // montée : 100 → 200
        { duration: '3m',  target: 200 }, // maintien à 200 users
        { duration: '1m',  target: 0   }, // descente
      ],
    },
  },
  thresholds: {
    // Seuils adaptés à 200 users simultanés
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed:   ['rate<0.05'],   // 5% d'erreurs max sous forte charge
    checks:            ['rate>0.95'],   // 95% de succès minimum
    errors:            ['rate<0.05'],
    public_endpoint_duration: ['p(95)<800'],
    auth_endpoint_duration:   ['p(95)<1000'],
    order_endpoint_duration:  ['p(95)<2000'],
  },
};

// Setup : récupère token admin + liste de produits + crée comptes de test
export function setup() {
  const headers = { 'Content-Type': 'application/json' };

  const loginRes = http.post(
    `${BASE_URL}/api/admin/login`,
    JSON.stringify({
      email:    __ENV.TEST_EMAIL    || 'admin@parapharmacie.ma',
      password: __ENV.TEST_PASSWORD || 'Admin1234!',
    }),
    { headers }
  );

  let adminToken = null;
  if (loginRes.status === 200) {
    adminToken = JSON.parse(loginRes.body).token;
  }

  const productsRes = http.get(`${BASE_URL}/api/products?limit=10`);
  let products = [];
  if (productsRes.status === 200) {
    products = JSON.parse(productsRes.body).products || [];
  }

  const catRes = http.get(`${BASE_URL}/api/categories`);
  let categories = [];
  if (catRes.status === 200) {
    const body = JSON.parse(catRes.body);
    categories = Array.isArray(body) ? body : (body.categories || []);
  }

  // Pré-créer 200 comptes et récupérer leurs tokens (1 token par VU)
  const clientTokens = [];
  for (let i = 0; i < 200; i++) {
    const email = `perf_user_${i}@test.com`;
    const password = 'Test1234!';
    let token = null;
    // Essayer login d'abord
    let res = http.post(`${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password }), { headers });
    if (res.status === 200) {
      try { token = JSON.parse(res.body).token; } catch {}
    } else {
      // Signup si le compte n'existe pas
      res = http.post(`${BASE_URL}/api/auth/signup`,
        JSON.stringify({ firstName: 'Perf', lastName: `User${i}`, email, password, phone: '0600000000' }),
        { headers });
      if (res.status === 201) {
        try { token = JSON.parse(res.body).token; } catch {}
      }
    }
    clientTokens.push(token);
  }

  return { adminToken, products, categories, clientTokens };
}

export default function (data) {
  const { adminToken, products, categories, clientTokens } = data;

  // Chaque VU simule un type d'utilisateur différent selon son numéro
  const userType = __VU % 4;

  switch (userType) {
    case 0: scenarioVisiteur(products, categories);  break;
    case 1: scenarioClient(products, clientTokens);  break;
    case 2: scenarioAdmin(adminToken);               break;
    case 3: scenarioRecherche(categories);           break;
  }
}

// ── Scénario 1 : Visiteur anonyme (navigation catalogue) ────────────────────
function scenarioVisiteur(products, categories) {
  group('visiteur', () => {
    // Page d'accueil
    const r1 = http.get(`${BASE_URL}/api/promotions/active`);
    publicDuration.add(r1.timings.duration);
    totalRequests.add(1);
    const ok1 = check(r1, { 'promotions 200': (r) => r.status === 200 });
    errorRate.add(!ok1);
    successRate.add(ok1);

    sleep(0.3);

    // Catégories
    const r2 = http.get(`${BASE_URL}/api/categories`);
    publicDuration.add(r2.timings.duration);
    totalRequests.add(1);
    const ok2 = check(r2, { 'categories 200': (r) => r.status === 200 });
    errorRate.add(!ok2);
    successRate.add(ok2);

    sleep(0.5);

    // Liste produits
    const page = Math.floor(Math.random() * 3) + 1;
    const r3 = http.get(`${BASE_URL}/api/products?page=${page}&limit=20`);
    publicDuration.add(r3.timings.duration);
    totalRequests.add(1);
    const ok3 = check(r3, { 'products list 200': (r) => r.status === 200 });
    errorRate.add(!ok3);
    successRate.add(ok3);

    sleep(0.5);

    // Fiche produit
    if (products.length > 0) {
      const p = products[Math.floor(Math.random() * products.length)];
      const r4 = http.get(`${BASE_URL}/api/products/${p.id}`);
      publicDuration.add(r4.timings.duration);
      totalRequests.add(1);
      const ok4 = check(r4, { 'product detail 200': (r) => r.status === 200 });
      errorRate.add(!ok4);
      successRate.add(ok4);
    }
  });

  sleep(1);
}

// ── Scénario 2 : Client connecté (commande) ──────────────────────────────────
function scenarioClient(products, clientTokens) {
  group('client', () => {
    // Utiliser le token pré-généré du setup (pas de bcrypt pendant le test)
    const token = clientTokens[(__VU - 1) % clientTokens.length];
    if (!token || products.length === 0) { sleep(2); return; }

    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Vérifier mes commandes (endpoint auth)
    const myOrdersRes = http.get(`${BASE_URL}/api/orders/my-orders`, { headers: authHeaders });
    authDuration.add(myOrdersRes.timings.duration);
    totalRequests.add(1);
    const okAuth = check(myOrdersRes, { 'auth check 200': (r) => r.status === 200 });
    errorRate.add(!okAuth);
    successRate.add(okAuth);

    sleep(1);

    // Créer commande seulement 1 fois sur 3 (réduit la pression sur la DB)
    if (__ITER % 3 === 0) {
      const product = products[Math.floor(Math.random() * products.length)];
      const orderRes = http.post(
        `${BASE_URL}/api/orders/create`,
        JSON.stringify({
          items: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }],
          total: product.price,
          paymentMethod: 'cash',
        }),
        { headers: authHeaders }
      );
      orderDuration.add(orderRes.timings.duration);
      totalRequests.add(1);
      const okOrder = check(orderRes, { 'order created 201': (r) => r.status === 201 });
      errorRate.add(!okOrder);
      successRate.add(okOrder);
    }
  });

  sleep(2);
}

// ── Scénario 3 : Admin (dashboard) ──────────────────────────────────────────
function scenarioAdmin(adminToken) {
  if (!adminToken) { sleep(2); return; }

  group('admin', () => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };

    const r1 = http.get(`${BASE_URL}/api/admin/kpis`, { headers });
    totalRequests.add(1);
    const ok1 = check(r1, { 'kpis 200': (r) => r.status === 200 });
    errorRate.add(!ok1);
    successRate.add(ok1);

    sleep(0.3);

    const r2 = http.get(`${BASE_URL}/api/admin/orders?page=1&limit=20`, { headers });
    totalRequests.add(1);
    check(r2, { 'admin orders 200': (r) => r.status === 200 });

    sleep(0.3);

    const r3 = http.get(`${BASE_URL}/api/admin/notifications/unread-count`, { headers });
    totalRequests.add(1);
    check(r3, { 'notif count 200': (r) => r.status === 200 });
  });

  sleep(1);
}

// ── Scénario 4 : Recherche ───────────────────────────────────────────────────
function scenarioRecherche(categories) {
  group('recherche', () => {
    // Filtre par catégorie (indexé, paginé, pas de full-scan)
    if (categories.length > 0) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const r1 = http.get(`${BASE_URL}/api/products?categoryId=${cat.id}&limit=10&page=1`);
      publicDuration.add(r1.timings.duration);
      totalRequests.add(1);
      const ok1 = check(r1, { 'filter by cat 200': (r) => r.status === 200 });
      errorRate.add(!ok1);
      successRate.add(ok1);
    }

    sleep(0.5);

    // Recherche courte (maintenant paginée via Prisma, pas de full-scan)
    const terms = ['creme', 'serum', 'vitamine', 'solaire'];
    const term  = terms[Math.floor(Math.random() * terms.length)];
    const r2 = http.get(`${BASE_URL}/api/products?search=${term}&limit=10&page=1`);
    publicDuration.add(r2.timings.duration);
    totalRequests.add(1);
    check(r2, { 'search 200': (r) => r.status === 200 });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/07_load_200_users_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m   = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;
  const checks = m.checks;

  const p95 = dur?.values?.['p(95)'] ?? 0;
  const p99 = dur?.values?.['p(99)'] ?? 0;
  const errPct = (failed?.values?.rate ?? 0) * 100;
  const checkPct = (checks?.values?.rate ?? 0) * 100;

  let verdict = '✅ L\'APPLICATION SUPPORTE 200 UTILISATEURS SIMULTANÉS';
  if (errPct > 5 || p95 > 1500) {
    verdict = '⚠️  OPTIMISATION RECOMMANDÉE SOUS 200 UTILISATEURS';
  }
  if (errPct > 15 || p95 > 3000) {
    verdict = '❌ L\'APPLICATION NE SUPPORTE PAS 200 UTILISATEURS SIMULTANÉS';
  }

  return `
╔══════════════════════════════════════════════════════════════╗
║  RAPPORT : 07 — TEST 200 UTILISATEURS SIMULTANÉS            ║
╚══════════════════════════════════════════════════════════════╝

📊 Volume
  Requêtes totales  : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit moyen       : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Taux d'erreur     : ${errPct.toFixed(2)}%
  Checks réussis    : ${checkPct.toFixed(2)}%

⏱  Temps de réponse global (ms)
  Médiane (p50)     : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p90               : ${(dur?.values?.['p(90)'] ?? 0).toFixed(0)}ms
  p95               : ${p95.toFixed(0)}ms  ${p95 < 800 ? '✅' : p95 < 1500 ? '⚠️' : '❌'}
  p99               : ${p99.toFixed(0)}ms  ${p99 < 1500 ? '✅' : p99 < 3000 ? '⚠️' : '❌'}
  Max               : ${(dur?.values?.max ?? 0).toFixed(0)}ms

⏱  Par type d'endpoint (p95)
  Endpoints publics : ${(m.public_endpoint_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  Authentification  : ${(m.auth_endpoint_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  Commandes         : ${(m.order_endpoint_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

🏁 VERDICT : ${verdict}

💡 Seuils recommandés pour 200 users :
   p95 < 1500ms ✅  |  Erreurs < 5% ✅  |  Checks > 95% ✅
`;
}
