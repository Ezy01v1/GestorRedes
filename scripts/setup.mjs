#!/usr/bin/env node
// Crea o completa .env a partir de .env.example. Es seguro ejecutarlo varias veces:
// nunca cambia un valor ya definido y nunca imprime secretos.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEnvFile } from './setup-lib.mjs';

const root = resolve(import.meta.dirname, '..');
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

const example = readFileSync(examplePath, 'utf8');
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null;
const { content, generated } = buildEnvFile(example, existing, randomBytes);

if (existing === content) {
  console.log('.env ya estaba completo; no se cambió nada.');
} else {
  writeFileSync(envPath, content, { mode: 0o600 });
  console.log(generated.length > 0 ? `Generadas: ${generated.join(', ')}` : '.env actualizado con nuevas variables.');
}

mkdirSync(resolve(root, 'data', 'media'), { recursive: true });
