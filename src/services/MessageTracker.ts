import { MessageLog, IMessageLog } from '../database/models/MessageLog.js'
import { logger } from '../utils/logger.js'

export class MessageTracker {
    /**
     * Log a message being sent
     */
    static async logMessage(data: {
        sessionId: string
        recipientJid: string
        recipientType: 'group' | 'personal'
        messageType: 'reminder' | 'command-response' | 'broadcast'
        messageContent: string
        location?: string
        prayerName?: string
    }): Promise<IMessageLog> {
        try {
            const log = await MessageLog.create({
                ...data,
                timestamp: new Date(),
                status: 'sent'
            })

            logger.debug(`Message logged: ${log._id}`)
            return log
        } catch (error) {
            logger.error({ error }, 'Failed to log message')
            throw error
        }
    }

    /**
     * Update message status
     */
    static async updateStatus(
        messageId: string,
        status: 'delivered' | 'read' | 'failed',
        error?: string
    ): Promise<void> {
        try {
            const update: any = { status }

            if (status === 'delivered') {
                update.deliveryTimestamp = new Date()
            } else if (status === 'read') {
                update.readTimestamp = new Date()
            } else if (status === 'failed' && error) {
                update.error = error
            }

            await MessageLog.findByIdAndUpdate(messageId, update)
            logger.debug(`Message ${messageId} status updated to ${status}`)
        } catch (error) {
            logger.error({ error }, 'Failed to update message status')
        }
    }

    /**
     * Get message statistics
     */
    static async getStatistics(sessionId?: string, hours: number = 24): Promise<{
        total: number
        sent: number
        delivered: number
        failed: number
        deliveryRate: number
    }> {
        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000)
            const query: any = { timestamp: { $gte: since } }

            if (sessionId) {
                query.sessionId = sessionId
            }

            const total = await MessageLog.countDocuments(query)
            const sent = await MessageLog.countDocuments({ ...query, status: 'sent' })
            const delivered = await MessageLog.countDocuments({ ...query, status: 'delivered' })
            const failed = await MessageLog.countDocuments({ ...query, status: 'failed' })

            const deliveryRate = total > 0 ? (delivered / total) * 100 : 0

            return {
                total,
                sent,
                delivered,
                failed,
                deliveryRate: Math.round(deliveryRate * 100) / 100
            }
        } catch (error) {
            logger.error({ error }, 'Failed to get message statistics')
            return {
                total: 0,
                sent: 0,
                delivered: 0,
                failed: 0,
                deliveryRate: 0
            }
        }
    }

    /**
     * Get failed messages
     */
    static async getFailedMessages(sessionId?: string, limit: number = 50): Promise<IMessageLog[]> {
        try {
            const query: any = { status: 'failed' }
            if (sessionId) {
                query.sessionId = sessionId
            }

            return await MessageLog.find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
        } catch (error) {
            logger.error({ error }, 'Failed to get failed messages')
            return []
        }
    }

    /**
     * Get messages by session
     */
    static async getSessionMessages(
        sessionId: string,
        limit: number = 100
    ): Promise<IMessageLog[]> {
        try {
            return await MessageLog.find({ sessionId })
                .sort({ timestamp: -1 })
                .limit(limit)
        } catch (error) {
            logger.error({ error }, 'Failed to get session messages')
            return []
        }
    }

    /**
     * Get today's message count
     */
    static async getTodayMessageCount(sessionId?: string): Promise<number> {
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const query: any = { timestamp: { $gte: today } }
            if (sessionId) {
                query.sessionId = sessionId
            }

            return await MessageLog.countDocuments(query)
        } catch (error) {
            logger.error({ error }, 'Failed to get today message count')
            return 0
        }
    }
}
