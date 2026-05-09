// tests/performance/05_user_journey.js
// Scénario complet : parcours utilisateur réaliste
// Visite → Recherche → Produit → Commande → Suivi
// Lancer : k6 run tests/performance/05_user_journey.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const HEADERS  = { 'Content-Type': 'application/json' };

const journeyDuration = new Trend('journey_duration', true);
const errorRate       = new Rate('error_rate');
const ordersCreated   = new Counter('orders_created');

export const options = {
  scenarios: {
    // Simule des utilisateurs qui naviguent en parallèle
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5  }, // 5 users simultanés
        { duration: '1m',  target: 10 }, // 10 users simultanés
        { duration: '30s', target: 20 }, // pic à 20 users
        { duration: '30s', target: 0  }, // descente
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:   ['rate<0.02'],  // 2% toléré pour le parcours complet
    checks:            ['rate>0.95'],
    journey_duration:  ['p(95)<5000'], // parcours complet < 5s
  },
};

export function setup() {
  // Récupérer des produits disponibles
  const res = http.get(`${BASE_URL}/api/products?limit=5&active=true`);
  let products = [];
  if (res.status === 200) {
    products = JSON.parse(res.body).products || [];
  }

  // Récupérer des catégories
  const catRes = http.get(`${BASE_URL}/api/categories`);
  let categories = [];
  if (catRes.status === 200) {
    const body = JSON.parse(catRes.body);
    categories = Array.isArray(body) ? body : (body.categories || []);
  }

  return { products, categories };
}

export default function (data) {
  const { products, categories } = data;
  const journeyStart = Date.now();

  // Chaque VU crée son propre compte pour éviter les conflits
  const uniqueEmail = `journey_${__VU}_${Date.now()}@test.com`;
  let userToken = null;
  let orderId   = null;

  // ── ÉTAPE 1 : Page d'accueil ─────────────────────────────────────────────
  group('1. Page accueil', () => {
    const res = http.get(`${BASE_URL}/api/promotions/active`);
    check(res, {
      'Promotions actives — 200': (r) => r.status === 200,
    });

    const catRes = http.get(`${BASE_URL}/api/categories`);
    check(catRes, {
      'Catégories — 200': (r) => r.status === 200,
    });
  });

  sleep(1); // Temps de lecture simulé

  // ── ÉTAPE 2 : Navigation catalogue ──────────────────────────────────────
  group('2. Catalogue produits', () => {
    const res = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
    check(res, {
      'Liste produits — 200':     (r) => r.status === 200,
      'Liste produits — < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(res.status !== 200);

    // Filtre par catégorie si disponible
    if (categories.length > 0) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const filteredRes = http.get(`${BASE_URL}/api/products?categoryId=${cat.id}&limit=10`);
      check(filteredRes, {
        'Produits par catégorie — 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1.5);

  // ── ÉTAPE 3 : Recherche ──────────────────────────────────────────────────
  group('3. Recherche', () => {
    const terms = ['creme', 'serum', 'vitamine', 'solaire', 'hydratant'];
    const term  = terms[Math.floor(Math.random() * terms.length)];
    const res   = http.get(`${BASE_URL}/api/products?search=${term}&limit=10`);
    check(res, {
      'Recherche — 200':     (r) => r.status === 200,
      'Recherche — < 600ms': (r) => r.timings.duration < 600,
    });
  });

  sleep(1);

  // ── ÉTAPE 4 : Fiche produit ──────────────────────────────────────────────
  group('4. Fiche produit', () => {
    if (products.length === 0) return;
    const product = products[Math.floor(Math.random() * products.length)];

    const res = http.get(`${BASE_URL}/api/products/${product.id}`);
    check(res, {
      'Fiche produit — 200':     (r) => r.status === 200,
      'Fiche produit — < 400ms': (r) => r.timings.duration < 400,
    });

    // Avis du produit
    const reviewsRes = http.get(`${BASE_URL}/api/reviews/${product.id}`);
    check(reviewsRes, {
      'Avis produit — 200': (r) => r.status === 200,
    });
  });

  sleep(2); // Temps de lecture de la fiche

  // ── ÉTAPE 5 : Inscription ────────────────────────────────────────────────
  group('5. Inscription', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/signup`,
      JSON.stringify({
        firstName: 'Journey',
        lastName:  `User${__VU}`,
        email:     uniqueEmail,
        password:  'Test1234!',
        phone:     '0600000000',
      }),
      { headers: HEADERS }
    );

    check(res, {
      'Signup — 201':       (r) => r.status === 201,
      'Signup — has token': (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
    });
    errorRate.add(res.status !== 201);

    if (res.status === 201) {
      try { userToken = JSON.parse(res.body).token; } catch {}
    }
  });

  sleep(0.5);

  // ── ÉTAPE 6 : Commande ───────────────────────────────────────────────────
  group('6. Passer commande', () => {
    if (!userToken || products.length === 0) return;

    const product = products[0];
    const res = http.post(
      `${BASE_URL}/api/orders/create`,
      JSON.stringify({
        items: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }],
        total:         product.price,
        paymentMethod: 'cash',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      }
    );

    check(res, {
      'Commande — 201':       (r) => r.status === 201,
      'Commande — < 1500ms':  (r) => r.timings.duration < 1500,
    });
    errorRate.add(res.status !== 201);

    if (res.status === 201) {
      ordersCreated.add(1);
      try { orderId = JSON.parse(res.body).order.id; } catch {}
    }
  });

  sleep(0.5);

  // ── ÉTAPE 7 : Suivi commande ─────────────────────────────────────────────
  group('7. Suivi commande', () => {
    if (!userToken) return;

    const authH = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
    };

    const res = http.get(`${BASE_URL}/api/orders/my-orders`, { headers: authH });
    check(res, {
      'Mes commandes — 200':     (r) => r.status === 200,
      'Mes commandes — < 500ms': (r) => r.timings.duration < 500,
    });

    if (orderId) {
      const detailRes = http.get(`${BASE_URL}/api/orders/${orderId}`, { headers: authH });
      check(detailRes, {
        'Détail commande — 200': (r) => r.status === 200,
      });
    }
  });

  // Durée totale du parcours
  journeyDuration.add(Date.now() - journeyStart);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/05_user_journey_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.http_req_failed;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT PERFORMANCE : 05 — Parcours Utilisateur     ║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Échecs        : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

🛒 Commandes créées : ${m.orders_created?.values?.count ?? 0}

⏱  Durées HTTP (ms)
  p50           : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms

⏱  Parcours complet (ms)
  p50           : ${(m.journey_duration?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95           : ${(m.journey_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

✅ Checks : ${((m.checks?.values?.rate ?? 0) * 100).toFixed(2)}%

${(failed?.values?.rate ?? 0) < 0.02 ? '✅ SEUILS RESPECTÉS' : '❌ SEUILS DÉPASSÉS'}
`;
}
