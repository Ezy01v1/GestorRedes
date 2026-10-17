import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  registerDecorator,
  validateSync,
  type ValidationOptions,
} from 'class-validator';

const BASE64_STRICT = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Exige una cadena base64 estricta (sin espacios) que decodifique exactamente a `bytes` bytes. */
export function IsBase64Key(bytes: number, options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isBase64Key',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: `debe ser base64 de exactamente ${bytes} bytes`, ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          value.length > 0 &&
          BASE64_STRICT.test(value) &&
          Buffer.from(value, 'base64').length === bytes,
      },
    });
  };
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsString()
  @IsNotEmpty()
  HOST = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  APP_PORT: number = 3000;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PUBLIC_GATEWAY_PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  TZ = 'UTC';

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  APP_BASE_URL = 'http://127.0.0.1:3000';

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, { message: 'debe ser una URL postgresql://' })
  DATABASE_URL!: string;

  @IsBase64Key(32)
  APP_ENCRYPTION_KEY!: string;

  @IsBase64Key(32)
  SESSION_SECRET!: string;

  @IsBase64Key(32)
  MEDIA_SIGNING_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  MEDIA_DIR = './data/media';

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  PUBLIC_BASE_URL?: string;

  @IsOptional() @IsString() META_APP_ID?: string;
  @IsOptional() @IsString() META_APP_SECRET?: string;
  @IsOptional() @IsString() INSTAGRAM_APP_ID?: string;
  @IsOptional() @IsString() INSTAGRAM_APP_SECRET?: string;
  @IsOptional() @IsString() LINKEDIN_CLIENT_ID?: string;
  @IsOptional() @IsString() LINKEDIN_CLIENT_SECRET?: string;
  @IsOptional() @IsString() WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;

  @Matches(/^v\d+\.\d+$/)
  META_GRAPH_VERSION = 'v26.0';

  @Matches(/^\d{6}$/)
  LINKEDIN_API_VERSION = '202609';

  @IsInt()
  @Min(1)
  @Type(() => Number)
  INBOX_POLL_MINUTES: number = 5;

  @IsString()
  @IsNotEmpty()
  SNAPSHOT_CRON = '0 3 * * *';

  @IsInt()
  @Min(0)
  @Type(() => Number)
  MISSED_POST_GRACE_MINUTES: number = 60;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';
}

/**
 * Valida el entorno al arrancar. El mensaje de error nombra las variables
 * inválidas y la regla incumplida, pero nunca incluye sus valores.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Las variables vacías del .env (FOO=) cuentan como no definidas.
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const env = plainToInstance(EnvironmentVariables, cleaned, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const names = errors.map((e) => e.property);
    const reasons = errors.map((e) => `  - ${e.property}: ${Object.keys(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration: ${names.join(', ')}\n${reasons.join('\n')}`);
  }
  return env;
}
