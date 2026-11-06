
import rateLimit from 'express-rate-limit'

/**
 * Creates an independent rate limiter for each service.
 * Authenticated users are tracked by their user ID,
 * not by a shared server-wide counter.
 */
export function createUserRateLimiter({
  service,
  windowMs,
  limit,
  message = 'Too many requests. Please try again later.',
}) {
  if (!service || !windowMs || !limit) {
    throw new Error('Rate limiter requires service, windowMs and limit.')
  }

  return rateLimit({
    windowMs,
    limit,

    // Separate counter for each service AND authenticated user.
    keyGenerator: (req) => {
      if (!req.user?.id) {
        throw new Error(
          `Authentication middleware must run before ${service} rate limiter.`
        )
      }

      return `${service}:user:${req.user.id}`
    },

    standardHeaders: true,
    legacyHeaders: false,

    message: { message },
  })
}
