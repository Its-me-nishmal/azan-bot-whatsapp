import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, IUser } from '../database/models/User.js'
import { logger } from '../utils/logger.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this'
const SALT_ROUNDS = 10

export interface TokenPayload {
    userId: string
    username: string
    role: string
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload
    } catch (error) {
        logger.error({ error }, 'Invalid token')
        return null
    }
}

/**
 * Create a new user
 */
export async function createUser(
    username: string,
    password: string,
    role: 'admin' | 'manager' = 'manager'
): Promise<IUser> {
    const hashedPassword = await hashPassword(password)

    const user = await User.create({
        username,
        password: hashedPassword,
        role
    })

    logger.info(`User created: ${username} (${role})`)
    return user
}

/**
 * Authenticate user and return token
 */
export async function authenticateUser(
    username: string,
    password: string
): Promise<{ token: string; user: { username: string; role: string } } | null> {
    const user = await User.findOne({ username })

    if (!user) {
        logger.warn(`Login attempt for non-existent user: ${username}`)
        return null
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
        logger.warn(`Failed login attempt for user: ${username}`)
        return null
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        role: user.role
    })

    logger.info(`User logged in: ${username}`)

    return {
        token,
        user: {
            username: user.username,
            role: user.role
        }
    }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId)
}
