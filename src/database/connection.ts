import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'

export async function connectDatabase(url: string): Promise<void> {
    try {
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        })
        logger.info('✅ Connected to MongoDB')

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error({ err }, 'MongoDB connection error')
        })

        mongoose.connection.on('disconnected', () => {
            logger.warn('⚠️  MongoDB disconnected')
        })

        mongoose.connection.on('reconnected', () => {
            logger.info('🔄 MongoDB reconnected')
        })

    } catch (error) {
        logger.error({ error }, '❌ Failed to connect to MongoDB')
        throw error
    }
}

export async function disconnectDatabase(): Promise<void> {
    await mongoose.disconnect()
    logger.info('MongoDB disconnected')
}

// Export alias for convenience
export const connectDB = connectDatabase
