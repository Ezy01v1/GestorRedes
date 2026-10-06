import { type INestApplication, ValidationPipe, type ValidationError } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { AppError } from './common/errors/app-error';

/** Aplana errores anidados de class-validator a { 'a.b': ['mensaje'] }. */
function collectFields(errors: ValidationError[], prefix = ''): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) fields[path] = Object.values(error.constraints);
    if (error.children?.length) Object.assign(fields, collectFields(error.children, path));
  }
  return fields;
}

/** Configuración común a main.ts y a los tests e2e, para que se comporten igual. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1', { exclude: ['healthz'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppError('VALIDATION_FAILED', 'Los datos enviados no son válidos.', 400, {
          fields: collectFields(errors),
        }),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  app.use(helmet());
  app.enableShutdownHooks();
}
