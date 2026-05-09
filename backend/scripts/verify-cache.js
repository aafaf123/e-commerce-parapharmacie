import { cacheGet, cacheSet, cacheDel, isRedisConnected } from '../src/utils/redisCache.js';

// Test SET
await cacheSet('test:key', { hello: 'world', ts: Date.now() }, 60);
const val = await cacheGet('test:key');
console.log('✅ Cache SET/GET :', val ? 'OK → ' + JSON.stringify(val) : '❌ FAIL');

// Test TTL (valeur expirée)
await cacheSet('test:ttl', 'expire', 1);
await new Promise(r => setTimeout(r, 1100));
const expired = await cacheGet('test:ttl');
console.log('✅ Cache TTL     :', expired === null ? 'OK → valeur expirée correctement' : '❌ FAIL (valeur encore présente)');

// Test DEL
await cacheSet('test:del', 'delete-me', 60);
await cacheDel('test:del');
const deleted = await cacheGet('test:del');
console.log('✅ Cache DEL     :', deleted === null ? 'OK → valeur supprimée' : '❌ FAIL');

// Mode
console.log('');
console.log('📦 Mode cache    :', isRedisConnected() ? '🔴 Redis (connecté)' : '🟡 Mémoire (fallback — Redis absent)');
