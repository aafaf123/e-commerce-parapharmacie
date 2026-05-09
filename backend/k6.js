#!/usr/bin/env node
// k6.js — wrapper pour lancer k6 depuis npm scripts sur Windows
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const K6_PATHS = [
  'C:\\Program Files\\k6\\k6.exe',
  'C:\\Program Files (x86)\\k6\\k6.exe',
  'k6', // si k6 est dans le PATH
];

const k6 = K6_PATHS.find(p => p === 'k6' || existsSync(p));
if (!k6) {
  console.error('❌ k6 introuvable. Installez-le depuis https://k6.io/docs/get-started/installation/');
  process.exit(1);
}

// Tous les arguments après "node k6.js" sont passés à k6
const args = process.argv.slice(2);
const result = spawnSync(k6, args, { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
