import { describe, expect, it } from 'bun:test'
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  BusinessLogicError,
  ConflictError,
  createErrorResponse,
  ErrorCodes,
  ForbiddenError,
  InternalServerError,
  isAuthenticationError,
  isAuthorizationError,
  isBabylonError,
  isOperationalError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../errors'

describe('Error Classes', () => {
  describe('ApiError', () => {
    it('creates error with default status code', () => {
      const error = new ApiError('test error')
      expect(error.message).toBe('test error')
      expect(error.statusCode).toBe(500)
      expect(error.code).toBeUndefined()
    })

    it('creates error with custom status code and code', () => {
      const error = new ApiError('bad request', 400, 'BAD_REQUEST')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('BAD_REQUEST')
    })
  })

  describe('AuthenticationError (from @babylon/shared)', () => {
    it('creates error with message and reason', () => {
      const error = new AuthenticationError('Token expired', 'EXPIRED_TOKEN')
      expect(error.message).toBe('Token expired')
      expect(error.code).toBe('AUTH_EXPIRED_TOKEN')
      expect(error.statusCode).toBe(401)
      expect(error.isOperational).toBe(true)
      expect(error.reason).toBe('EXPIRED_TOKEN')
    })

    it('creates error for missing token', () => {
      const error = new AuthenticationError('No token provided', 'NO_TOKEN')
      expect(error.code).toBe('AUTH_NO_TOKEN')
      expect(error.reason).toBe('NO_TOKEN')
    })
  })

  describe('AuthorizationError (from @babylon/shared)', () => {
    it('creates error with message, resource and action', () => {
      const error = new AuthorizationError(
        'Cannot delete post',
        'post',
        'delete',
      )
      expect(error.message).toBe('Cannot delete post')
      expect(error.code).toBe('FORBIDDEN')
      expect(error.statusCode).toBe(403)
      expect(error.resource).toBe('post')
      expect(error.action).toBe('delete')
    })
  })

  describe('UnauthorizedError (API-specific)', () => {
    it('creates error with default message', () => {
      const error = new UnauthorizedError()
      expect(error.message).toBe('Unauthorized')
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.statusCode).toBe(401)
    })

    it('creates error with custom message and code', () => {
      const error = new UnauthorizedError('Invalid token', 'INVALID_TOKEN')
      expect(error.message).toBe('Invalid token')
      expect(error.code).toBe('INVALID_TOKEN')
    })
  })

  describe('ForbiddenError (API-specific)', () => {
    it('creates error with default message', () => {
      const error = new ForbiddenError()
      expect(error.message).toBe('Forbidden')
      expect(error.code).toBe('FORBIDDEN')
      expect(error.statusCode).toBe(403)
    })

    it('creates error with custom message and code', () => {
      const error = new ForbiddenError('Access denied', 'ACCESS_DENIED')
      expect(error.message).toBe('Access denied')
      expect(error.code).toBe('ACCESS_DENIED')
    })
  })

  describe('BadRequestError (from @babylon/shared)', () => {
    it('creates error with 400 status', () => {
      const error = new BadRequestError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('BAD_REQUEST')
    })

    it('creates error with details', () => {
      const error = new BadRequestError('Invalid input', { field: 'email' })
      expect(error.context).toEqual({ field: 'email' })
    })
  })

  describe('NotFoundError (from @babylon/shared)', () => {
    it('creates error with resource name', () => {
      const error = new NotFoundError('User')
      expect(error.message).toBe('User not found')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('creates error with resource and identifier', () => {
      const error = new NotFoundError('User', '123')
      expect(error.message).toBe('User not found: 123')
    })

    it('creates error with custom message', () => {
      const error = new NotFoundError('User', undefined, 'Cannot find user')
      expect(error.message).toBe('Cannot find user')
    })
  })

  describe('ConflictError (from @babylon/shared)', () => {
    it('creates error with 409 status', () => {
      const error = new ConflictError('Resource already exists')
      expect(error.statusCode).toBe(409)
      expect(error.code).toBe('CONFLICT')
    })

    it('creates error with conflicting resource', () => {
      const error = new ConflictError('Duplicate entry', 'user')
      expect(error.conflictingResource).toBe('user')
    })
  })

  describe('ValidationError (from @babylon/shared)', () => {
    it('creates error with validation violations', () => {
      const violations = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Too short' },
      ]
      const error = new ValidationError(
        'Validation failed',
        ['email', 'password'],
        violations,
      )
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.fields).toEqual(['email', 'password'])
      expect(error.violations).toEqual(violations)
    })
  })

  describe('RateLimitError (from @babylon/shared)', () => {
    it('creates error with limit and window', () => {
      const error = new RateLimitError(100, 60000)
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe('RATE_LIMIT')
      expect(error.limit).toBe(100)
      expect(error.windowMs).toBe(60000)
    })

    it('creates error with retry after', () => {
      const error = new RateLimitError(100, 60000, 30)
      expect(error.retryAfter).toBe(30)
    })
  })

  describe('InternalServerError (from @babylon/shared)', () => {
    it('creates non-operational error with default message', () => {
      const error = new InternalServerError()
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(false)
      expect(error.message).toBe('An unexpected error occurred')
    })

    it('creates error with custom message', () => {
      const error = new InternalServerError('Database connection failed')
      expect(error.message).toBe('Database connection failed')
    })
  })

  describe('ServiceUnavailableError (from @babylon/shared)', () => {
    it('creates error with 503 status', () => {
      const error = new ServiceUnavailableError()
      expect(error.statusCode).toBe(503)
      expect(error.message).toBe('Service temporarily unavailable')
    })

    it('creates error with retry after', () => {
      const error = new ServiceUnavailableError('Maintenance mode', 60)
      expect(error.retryAfter).toBe(60)
    })
  })

  describe('BusinessLogicError (from @babylon/shared)', () => {
    it('creates error with custom code', () => {
      const error = new BusinessLogicError(
        'Insufficient balance',
        'INSUFFICIENT_FUNDS',
        { balance: 100, required: 200 },
      )
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('INSUFFICIENT_FUNDS')
      expect(error.context).toEqual({ balance: 100, required: 200 })
    })
  })
})

describe('Type Guards', () => {
  describe('isAuthenticationError', () => {
    it('returns true for AuthenticationError', () => {
      const error = new AuthenticationError('Test', 'NO_TOKEN')
      expect(isAuthenticationError(error)).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isAuthenticationError(new Error())).toBe(false)
      expect(
        isAuthenticationError(
          new AuthorizationError('Test', 'resource', 'action'),
        ),
      ).toBe(false)
    })
  })

  describe('isAuthorizationError', () => {
    it('returns true for AuthorizationError', () => {
      const error = new AuthorizationError('Test', 'resource', 'action')
      expect(isAuthorizationError(error)).toBe(true)
    })

    it('returns true for ForbiddenError (same code)', () => {
      const error = new ForbiddenError()
      expect(isAuthorizationError(error)).toBe(true)
    })

    it('returns false for AuthenticationError', () => {
      expect(
        isAuthorizationError(new AuthenticationError('Test', 'NO_TOKEN')),
      ).toBe(false)
    })
  })

  describe('isBabylonError', () => {
    it('returns true for all BabylonError subclasses', () => {
      expect(isBabylonError(new AuthenticationError('Test', 'NO_TOKEN'))).toBe(
        true,
      )
      expect(
        isBabylonError(new AuthorizationError('Test', 'resource', 'action')),
      ).toBe(true)
      expect(isBabylonError(new BadRequestError('test'))).toBe(true)
      expect(isBabylonError(new NotFoundError('Resource'))).toBe(true)
      expect(isBabylonError(new InternalServerError())).toBe(true)
      expect(isBabylonError(new UnauthorizedError())).toBe(true)
      expect(isBabylonError(new ForbiddenError())).toBe(true)
    })

    it('returns false for non-BabylonError', () => {
      expect(isBabylonError(new Error())).toBe(false)
      expect(isBabylonError(new ApiError('test'))).toBe(false)
      expect(isBabylonError('string')).toBe(false)
      expect(isBabylonError(null)).toBe(false)
    })
  })

  describe('isOperationalError', () => {
    it('returns true for operational errors', () => {
      expect(
        isOperationalError(new AuthenticationError('Test', 'NO_TOKEN')),
      ).toBe(true)
      expect(isOperationalError(new BadRequestError('test'))).toBe(true)
      expect(isOperationalError(new RateLimitError(100, 60000))).toBe(true)
      expect(isOperationalError(new UnauthorizedError())).toBe(true)
    })

    it('returns false for non-operational errors', () => {
      expect(isOperationalError(new InternalServerError())).toBe(false)
    })

    it('returns false for non-BabylonError', () => {
      expect(isOperationalError(new Error())).toBe(false)
    })
  })
})

describe('createErrorResponse', () => {
  it('creates basic error response', () => {
    const error = new BadRequestError('Invalid input')
    const response = createErrorResponse(error)

    expect(response).toEqual({
      error: {
        message: 'Invalid input',
        code: 'BAD_REQUEST',
      },
    })
  })

  it('includes validation violations for ValidationError', () => {
    const violations = [
      { field: 'email', message: 'Invalid format' },
      { field: 'name', message: 'Required' },
    ]
    const error = new ValidationError(
      'Validation failed',
      ['email', 'name'],
      violations,
    )
    const response = createErrorResponse(error)

    expect(response.error.violations).toEqual(violations)
  })
})

describe('ErrorCodes', () => {
  it('has all expected error codes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
    expect(ErrorCodes.AUTH_NO_TOKEN).toBe('AUTH_NO_TOKEN')
    expect(ErrorCodes.RATE_LIMIT).toBe('RATE_LIMIT')
    expect(ErrorCodes.BLOCKCHAIN_ERROR).toBe('BLOCKCHAIN_ERROR')
  })
})
