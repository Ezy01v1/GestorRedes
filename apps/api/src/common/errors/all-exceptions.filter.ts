import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  type LoggerService,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, type ErrorBody } from './app-error';

const INTERNAL_MESSAGE = 'Error interno. Revisa los logs con el requestId.';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

const PRISMA_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'El recurso no existe.' },
  P2003: { status: 409, code: 'IN_USE', message: 'El recurso está en uso por otros registros.' },
};

/** Detecta errores conocidos de Prisma sin importar el cliente (se genera más tarde). */
function prismaCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    error.constructor.name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as unknown as { code: string }).code;
  }
  return undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string | number }>();
    const res = http.getResponse<Response>();
    const body = this.toBody(exception, String(req.id ?? ''));

    if (body.statusCode >= 500) {
      this.logger.error({ err: exception, requestId: body.requestId }, 'Unhandled error');
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId: string): ErrorBody {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.status,
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: CODE_BY_STATUS[statusCode] ?? (statusCode >= 500 ? 'INTERNAL' : 'HTTP_ERROR'),
        message: statusCode >= 500 ? INTERNAL_MESSAGE : exception.message,
        requestId,
      };
    }

    const known = PRISMA_ERRORS[prismaCode(exception) ?? ''];
    if (known) {
      return { statusCode: known.status, code: known.code, message: known.message, requestId };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: INTERNAL_MESSAGE,
      requestId,
    };
  }
}
