// tests/performance/02_auth.js
// Endpoints d'authentification : login, signup
// Lancer : k6 run tests/performance/02_auth.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const HEADERS  = { 'Content-Type': 'application/json' };

const loginDuration  = new Trend('login_duration',  true);
const signupDuration = new Trend('signup_duration', true);
const errorRate      = new Rate('error_rate');

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '20s',
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 5  },
        { duration: '40s', target: 10 },
        { duration: '20s', target: 0  },
      ],
      startTime: '25s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    // On exclut les 401/400 intentionnels du taux d'échec
    // en utilisant uniquement la métrique error_rate personnalisée
    error_rate:        ['rate<0.01'],
    checks:            ['rate>0.99'],
    login_duration:    ['p(95)<600'],
    signup_duration:   ['p(95)<800'],
  },
};

// Crée un compte admin de test au setup pour les tests de login
export function setup() {
  // On utilise un compte existant — à adapter selon ta DB de test
  return {
    existingEmail:    __ENV.TEST_EMAIL    || 'admin@parapharmacie.ma',
    existingPassword: __ENV.TEST_PASSWORD || 'Admin1234!',
  };
}

export default function (data) {
  const { existingEmail, existingPassword } = data;

  // ── 1. Login valide ──────────────────────────────────────────────────────
  {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: existingEmail, password: existingPassword }),
      { headers: HEADERS }
    );
    loginDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'POST /auth/login — 200':       (r) => r.status === 200,
      'POST /auth/login — has token': (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
      'POST /auth/login — < 600ms':   (r) => r.timings.duration < 600,
    });
  }

  sleep(1);

  // ── 2. Login avec mauvais mot de passe ───────────────────────────────────
  {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: existingEmail, password: 'mauvais_mdp' }),
      { headers: HEADERS }
    );
    errorRate.add(res.status !== 401);

    check(res, {
      'POST /auth/login invalide — 401':     (r) => r.status === 401,
      'POST /auth/login invalide — < 800ms': (r) => r.timings.duration < 800,
    });
  }

  sleep(0.5);

  // ── 3. Login champs manquants ────────────────────────────────────────────
  {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: existingEmail }),
      { headers: HEADERS }
    );
    check(res, {
      'POST /auth/login sans mdp — 400': (r) => r.status === 400,
    });
  }

  sleep(0.5);

  // ── 4. Signup (nouvel utilisateur unique) ────────────────────────────────
  {
    const uniqueEmail = `perf_${__VU}_${Date.now()}@test.com`;
    const res = http.post(
      `${BASE_URL}/api/auth/signup`,
      JSON.stringify({
        firstName: 'Perf',
        lastName:  'Test',
        email:     uniqueEmail,
        password:  'Test1234!',
        phone:     '0600000000',
      }),
      { headers: HEADERS }
    );
    signupDuration.add(res.timings.duration);
    errorRate.add(res.status !== 201);

    check(res, {
      'POST /auth/signup — 201':       (r) => r.status === 201,
      'POST /auth/signup — has token': (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
      'POST /auth/signup — < 800ms':   (r) => r.timings.duration < 800,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/performance/reports/02_auth_summary.json': JSON.stringify(data, null, 2),
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration;
  const failed = m.error_rate;
  const checks = m.checks;

  return `
╔══════════════════════════════════════════════════════╗
║  RAPPORT PERFORMANCE : 02 — Authentification         ║
╚══════════════════════════════════════════════════════╝

📊 Requêtes
  Total         : ${m.http_reqs?.values?.count ?? 'N/A'}
  Débit         : ${(m.http_reqs?.values?.rate ?? 0).toFixed(2)} req/s
  Échecs        : ${((failed?.values?.rate ?? 0) * 100).toFixed(2)}%

⏱  Durées globales (ms)
  p50           : ${(dur?.values?.['p(50)'] ?? 0).toFixed(0)}ms
  p95           : ${(dur?.values?.['p(95)'] ?? 0).toFixed(0)}ms
  p99           : ${(dur?.values?.['p(99)'] ?? 0).toFixed(0)}ms

⏱  Login spécifique (ms)
  p95           : ${(m.login_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

⏱  Signup spécifique (ms)
  p95           : ${(m.signup_duration?.values?.['p(95)'] ?? 0).toFixed(0)}ms

✅ Checks : ${((checks?.values?.rate ?? 0) * 100).toFixed(2)}%

${(failed?.values?.rate ?? 0) < 0.01 ? '✅ SEUILS RESPECTÉS' : '❌ SEUILS DÉPASSÉS'}
`;
}
