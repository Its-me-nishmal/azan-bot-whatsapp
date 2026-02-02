import { WhatsAppBot } from './WhatsAppBot.js'
import { MessageHandler } from './MessageHandler.js'
import { Session } from '../database/models/Session.js'
import { AuthState } from '../database/models/AuthState.js'
import { GroupConfig } from '../database/models/GroupConfig.js'
import { AzanService } from '../services/azanService.js'
import { logger } from '../utils/logger.js'

export class SessionManager {
    private activeSessions = new Map<string, WhatsAppBot>()
    private messageHandler: MessageHandler | null = null

    constructor(azanService?: AzanService) {
        if (azanService) {
            this.messageHandler = new MessageHandler(azanService)
        }
    }

    /**
     * Create a new WhatsApp bot session
     */
    async createSession(sessionId: string, phoneNumber?: string): Promise<WhatsAppBot> {
        // Check if session already exists
        if (this.activeSessions.has(sessionId)) {
            logger.warn(`Session ${sessionId} already exists`)
            return this.activeSessions.get(sessionId)!
        }

        // Create session document if not exists
        await Session.findOneAndUpdate(
            { sessionId },
            {
                sessionId,
                phoneNumber,
                status: 'pending',
                createdAt: new Date()
            },
            { upsert: true }
        )

        // Create and connect bot with message handler
        const bot = new WhatsAppBot(sessionId, this.messageHandler || undefined)
        this.activeSessions.set(sessionId, bot)

        // Connect in background
        bot.connect().catch(error => {
            logger.error({ error }, `Failed to connect session ${sessionId}`)
        })

        logger.info(`Created session: ${sessionId}`)
        return bot
    }

    /**
     * Delete a session and clean up all data
     */
    async deleteSession(sessionId: string): Promise<void> {
        const bot = this.activeSessions.get(sessionId)

        if (bot) {
            await bot.disconnect()
            this.activeSessions.delete(sessionId)
        }

        // Clean up database
        await this.cleanupSessionData(sessionId)

        logger.info(`Deleted session: ${sessionId}`)
    }

    /**
     * Get a specific session
     */
    getSession(sessionId: string): WhatsAppBot | undefined {
        return this.activeSessions.get(sessionId)
    }

    /**
     * Get all active sessions
     */
    getAllSessions(): WhatsAppBot[] {
        return Array.from(this.activeSessions.values())
    }

    /**
     * Restart a session
     */
    async restartSession(sessionId: string): Promise<void> {
        await this.deleteSession(sessionId)
        await this.createSession(sessionId)
    }

    /**
     * Restore sessions from database on startup
     */
    async restoreSessionsFromDatabase(): Promise<void> {
        const sessions = await Session.find({ status: 'connected' })

        logger.info(`Restoring ${sessions.length} sessions from database...`)

        for (const session of sessions) {
            try {
                await this.createSession(session.sessionId, session.phoneNumber || undefined)
            } catch (error) {
                logger.error({ error }, `Failed to restore session ${session.sessionId}`)
            }
        }
    }

    /**
     * Clean up all session data from database
     */
    private async cleanupSessionData(sessionId: string): Promise<void> {
        await Promise.all([
            Session.deleteOne({ sessionId }),
            AuthState.deleteMany({ sessionId }),
            GroupConfig.deleteMany({ sessionId })
        ])
    }

    /**
     * Get session count
     */
    getSessionCount(): number {
        return this.activeSessions.size
    }
}
