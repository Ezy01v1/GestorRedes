import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import { stdSerializers } from 'pino';
import type { EnvironmentVariables } from '../../config/env.validation';
import { REDACT_PATHS, sanitizeText, sanitizeUrl } from './redaction';

const REQUEST_ID_HEADER = 'x-request-id';

export function buildLoggerParams(
  env: Pick<EnvironmentVariables, 'LOG_LEVEL' | 'NODE_ENV'>,
): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      genReqId: (req: IncomingMessage) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        return typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
          ? incoming
          : randomUUID();
      },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: sanitizeUrl(req.url),
        }),
        err: (err: Error) => {
          const serialized = stdSerializers.err(err);
          return {
            ...serialized,
            message: sanitizeText(serialized.message),
            stack: sanitizeText(serialized.stack),
          };
        },
      },
      autoLogging: { ignore: (req: IncomingMessage) => req.url === '/healthz' },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
    },
  };
}
