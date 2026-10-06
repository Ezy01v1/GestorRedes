const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
const CUSTOM_HEADER = '# ── Variables propias ──';

/** Claves que se generan si están vacías, con la función que produce su valor. */
const GENERATORS = {
  POSTGRES_PASSWORD: (random) => random(24).toString('base64url'),
  APP_ENCRYPTION_KEY: (random) => random(32).toString('base64'),
  SESSION_SECRET: (random) => random(32).toString('base64'),
  MEDIA_SIGNING_SECRET: (random) => random(32).toString('base64'),
};

/** Separa `valor   # comentario` respetando valores con espacios (p. ej. un cron). */
function splitValue(raw) {
  const match = raw.match(/^(.*?)(\s+#.*)?$/);
  return { value: (match?.[1] ?? '').trim(), comment: match?.[2] ?? '' };
}

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(KEY_LINE);
    if (m) values.set(m[1], splitValue(m[2]).value);
  }
  return values;
}

/**
 * Construye el contenido de .env a partir de .env.example sin tocar nunca un valor
 * existente no vacío. Rellena los secretos vacíos y DATABASE_URL.
 * @param {string} exampleText contenido de .env.example
 * @param {string | null} existingText contenido actual de .env (null si no existe)
 * @param {(n: number) => Buffer} randomBytes fuente de aleatoriedad
 * @returns {{ content: string, generated: string[] }} `generated` solo contiene nombres
 */
export function buildEnvFile(exampleText, existingText, randomBytes) {
  const existing = existingText === null ? new Map() : parseEnv(existingText);
  const exampleLines = exampleText.replace(/\r?\n$/, '').split(/\r?\n/);
  const exampleKeys = new Set();
  const resolved = new Map();
  const generated = [];

  const entries = exampleLines.map((line) => {
    const m = line.match(KEY_LINE);
    if (!m) return { line };
    const key = m[1];
    exampleKeys.add(key);
    const { value: exampleValue, comment } = splitValue(m[2]);
    let value = existing.get(key) || exampleValue;
    if (!value && GENERATORS[key]) {
      value = GENERATORS[key](randomBytes);
      generated.push(key);
    }
    resolved.set(key, value);
    return { key, comment };
  });

  if (resolved.has('DATABASE_URL') && !resolved.get('DATABASE_URL')) {
    const user = resolved.get('POSTGRES_USER') || 'socialhub';
    const password = resolved.get('POSTGRES_PASSWORD') ?? '';
    const db = resolved.get('POSTGRES_DB') || 'socialhub';
    const port = resolved.get('DB_PORT') || '5432';
    resolved.set('DATABASE_URL', `postgresql://${user}:${password}@127.0.0.1:${port}/${db}`);
    generated.push('DATABASE_URL');
  }

  const lines = entries.map((e) => ('line' in e ? e.line : `${e.key}=${resolved.get(e.key)}${e.comment}`));

  const custom = [...existing].filter(([key]) => !exampleKeys.has(key));
  if (custom.length > 0) {
    lines.push('', CUSTOM_HEADER, ...custom.map(([key, value]) => `${key}=${value}`));
  }

  return { content: `${lines.join('\n')}\n`, generated };
}
