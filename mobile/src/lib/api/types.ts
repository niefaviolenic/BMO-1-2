export type ApiErrorEnvelope = {
  error: string;
  message?: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAuthenticationFailed(error: unknown): boolean {
  return isApiError(error) && (error.code === 'AUTHENTICATION_FAILED' || error.status === 401);
}
