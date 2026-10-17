export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IN_USE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INTERNAL';

/** Error de dominio con código estable; el filtro global lo convierte en la respuesta HTTP. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}
