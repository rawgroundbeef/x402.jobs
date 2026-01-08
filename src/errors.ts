import type { ErrorCode } from './types'

export class X402Error extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string, status: number) {
    super(message)
    this.name = 'X402Error'
    this.code = code
    this.status = status

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, X402Error)
    }
  }

  static notFound(message = 'Resource not found'): X402Error {
    return new X402Error('NOT_FOUND', message, 404)
  }

  static paymentRequired(message = 'Payment required'): X402Error {
    return new X402Error('PAYMENT_REQUIRED', message, 402)
  }

  static rateLimited(message = 'Too many requests'): X402Error {
    return new X402Error('RATE_LIMITED', message, 429)
  }

  static unauthorized(message = 'Invalid or missing API key'): X402Error {
    return new X402Error('UNAUTHORIZED', message, 401)
  }

  static forbidden(message = 'Access denied'): X402Error {
    return new X402Error('FORBIDDEN', message, 403)
  }

  static validationError(message: string): X402Error {
    return new X402Error('VALIDATION_ERROR', message, 400)
  }

  static serverError(message = 'Internal server error'): X402Error {
    return new X402Error('SERVER_ERROR', message, 500)
  }

  static fromStatus(status: number, message?: string): X402Error {
    switch (status) {
      case 400:
        return X402Error.validationError(message ?? 'Invalid request')
      case 401:
        return X402Error.unauthorized(message)
      case 402:
        return X402Error.paymentRequired(message)
      case 403:
        return X402Error.forbidden(message)
      case 404:
        return X402Error.notFound(message)
      case 429:
        return X402Error.rateLimited(message)
      default:
        return X402Error.serverError(message)
    }
  }
}
