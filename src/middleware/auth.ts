import { Socket } from 'socket.io'
import { verifyToken, TokenPayload } from '../services/authService.js'
import { logger } from '../utils/logger.js'

/**
 * Rate limiter storage
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100

/**
 * WebSocket authentication middleware
 */
export function authenticateSocket(socket: Socket): boolean {
    const token = socket.handshake.auth.token

    if (!token) {
        logger.warn(`Connection attempt without token from ${socket.id}`)
        return false
    }

    const payload = verifyToken(token)

    if (!payload) {
        logger.warn(`Connection attempt with invalid token from ${socket.id}`)
        return false
    }

    // Attach user info to socket
    socket.data.authenticated = true
    socket.data.user = payload

    logger.info(`Authenticated user ${payload.username} (${payload.role}) - Socket ${socket.id}`)
    return true
}

/**
 * Check if event requires authentication
 */
export function requireAuth(socket: Socket, eventName: string): boolean {
    // Public events that don't require auth
    const publicEvents = ['auth:login', 'auth:register']

    if (publicEvents.includes(eventName)) {
        return true
    }

    // All other events require authentication
    if (!socket.data.authenticated) {
        socket.emit('error', {
            event: eventName,
            message: 'Authentication required'
        })
        return false
    }

    return true
}

/**
 * Rate limiting middleware
 */
export function checkRateLimit(socket: Socket, eventName: string): boolean {
    const userId = socket.data.user?.userId || socket.id
    const key = `${userId}:${eventName}`

    const now = Date.now()
    const record = rateLimitMap.get(key)

    if (!record || now > record.resetTime) {
        // New window
        rateLimitMap.set(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        })
        return true
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        logger.warn(`Rate limit exceeded for ${userId} on ${eventName}`)
        socket.emit('error', {
            event: eventName,
            message: 'Rate limit exceeded. Please try again later.'
        })
        return false
    }

    record.count++
    return true
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []

    rateLimitMap.forEach((record, key) => {
        if (now > record.resetTime) {
            keysToDelete.push(key)
        }
    })

    keysToDelete.forEach(key => rateLimitMap.delete(key))

    if (keysToDelete.length > 0) {
        logger.debug(`Cleaned up ${keysToDelete.length} expired rate limit records`)
    }
}, 5 * 60 * 1000) // Every 5 minutes
