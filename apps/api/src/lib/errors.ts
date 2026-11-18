export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) => new HttpError(400, code, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, 'forbidden', msg);
export const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`);
export const conflict = (code: string, msg: string, details?: unknown) => new HttpError(409, code, msg, details);
export const tooMany = (code: string, msg: string, details?: unknown) => new HttpError(429, code, msg, details);
