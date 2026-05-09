// tests/performance/debug_auth.js
// Script de debug pour identifier les échecs auth
// Lancer : k6 run debug_auth.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const HEADERS  = { 'Content-Type': 'application/json' };

export const options = {
  vus: 1,
  iterations: 3,
};

export function setup() {
  return {
    email:    __ENV.TEST_EMAIL    || 'admin@parapharmacie.ma',
    password: __ENV.TEST_PASSWORD || 'admin123',
  };
}

export default function (data) {
  console.log(`\n=== Itération ${__ITER + 1} / VU ${__VU} ===`);

  // Test 1 : Login
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    { headers: HEADERS }
  );
  console.log(`LOGIN → status=${loginRes.status} body=${loginRes.body.slice(0, 100)}`);
  check(loginRes, { 'login 200': (r) => r.status === 200 });

  sleep(0.5);

  // Test 2 : Login mauvais mdp
  const badRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: data.email, password: 'wrong' }),
    { headers: HEADERS }
  );
  console.log(`LOGIN BAD → status=${badRes.status}`);
  check(badRes, { 'login bad 401': (r) => r.status === 401 });

  sleep(0.5);

  // Test 3 : Login sans mdp
  const noPassRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: data.email }),
    { headers: HEADERS }
  );
  console.log(`LOGIN NO PASS → status=${noPassRes.status} body=${noPassRes.body.slice(0, 100)}`);
  check(noPassRes, { 'login no pass 400': (r) => r.status === 400 });

  sleep(0.5);

  // Test 4 : Signup
  const email = `perf_${__VU}_${__ITER}_${Date.now()}@test.com`;
  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify({ firstName: 'Perf', lastName: 'Test', email, password: 'Test1234!', phone: '0600000000' }),
    { headers: HEADERS }
  );
  console.log(`SIGNUP → status=${signupRes.status} body=${signupRes.body.slice(0, 100)}`);
  check(signupRes, { 'signup 201': (r) => r.status === 201 });

  sleep(1);
}
