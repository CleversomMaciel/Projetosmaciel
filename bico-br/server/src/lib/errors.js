export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const badRequest = (code, message, extra) => new AppError(400, code, message, extra);
export const unauthorized = (message = 'Autenticação necessária') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Acesso negado') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (code, message) => new AppError(404, code, message);
export const conflict = (code, message) => new AppError(409, code, message);

/** Erros dos provedores externos */
export class ProviderNotFound extends Error {}
export class ProviderError extends Error {
  constructor(message, { kind = 'error', status } = {}) {
    super(message);
    this.kind = kind; // 'error' | 'timeout' | 'rate_limited'
    this.status = status;
  }
}
