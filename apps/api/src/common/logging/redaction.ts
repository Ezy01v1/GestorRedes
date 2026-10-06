/** Rutas que pino reemplaza por `[REDACTED]` antes de escribir cualquier línea de log. */
export const REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.access_token',
  '*.refresh_token',
  '*.token',
  '*.password',
  '*.passwordHash',
  '*.client_secret',
  '*.apiKey',
  '*.accessToken',
  '*.refreshToken',
];

const SENSITIVE_PARAM = /token|secret|code|signature|password|key|state/i;
const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid';

/** Sustituye el valor de los parámetros de query sensibles. Nunca lanza. */
export function sanitizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, PLACEHOLDER_ORIGIN);
  } catch {
    return url;
  }
  let changed = false;
  for (const name of [...parsed.searchParams.keys()]) {
    if (SENSITIVE_PARAM.test(name)) {
      parsed.searchParams.set(name, '[REDACTED]');
      changed = true;
    }
  }
  if (!changed) return url;
  const isAbsolute = parsed.origin !== PLACEHOLDER_ORIGIN;
  return (isAbsolute ? parsed.origin : '') + parsed.pathname + parsed.search + parsed.hash;
}

const TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/((?:access_token|refresh_token|client_secret|id_token)=)[^&\s"']+/gi, '$1[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]'],
  [
    /("(?:access_token|refresh_token|client_secret|id_token|token|password)"\s*:\s*")[^"]*"/gi,
    '$1[REDACTED]"',
  ],
];

/** Redacta tokens y secretos que aparezcan dentro de texto libre (mensajes de error, stacks). */
export function sanitizeText(text: string): string {
  return TEXT_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}
