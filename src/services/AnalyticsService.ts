import { Session } from '../database/models/Session.js'
import { GroupConfig } from '../database/models/GroupConfig.js'
import { MessageTracker } from './MessageTracker.js'
import { logger } from '../utils/logger.js'

export interface Statistics {
    totalSessions: number
    activeSessions: number
    totalGroups: number
    messagesDeliveredToday: number
    messagesFailedToday: number
    uptime: number
    lastReminderSent?: Date
    deliveryRate: number
    topLocations: Array<{ location: string; count: number }>
    sessionHealth: Array<{
        sessionId: string
        status: string
        groupCount: number
        lastActive?: Date
    }>
}

export class AnalyticsService {
    private startTime: Date

    constructor() {
        this.startTime = new Date()
    }

    /**
     * Get comprehensive system statistics
     */
    async getStatistics(): Promise<Statistics> {
        try {
            // Session statistics
            const sessions = await Session.find()
            const totalSessions = sessions.length
            const activeSessions = sessions.filter(s => s.status === 'connected').length

            // Group statistics
            const groups = await GroupConfig.find()
            const totalGroups = groups.length

            // Message statistics (today)
            const messageStats = await MessageTracker.getStatistics(undefined, 24)
            const messagesDeliveredToday = messageStats.delivered
            const messagesFailedToday = messageStats.failed
            const deliveryRate = messageStats.deliveryRate

            // Uptime in seconds
            const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000)

            // Last reminder sent (from message logs)
            const recentMessage = await MessageTracker.getSessionMessages('any', 1)
            const lastReminderSent = recentMessage[0]?.timestamp

            // Top locations by group count
            const locationCounts = new Map<string, number>()
            groups.forEach(g => {
                const count = locationCounts.get(g.locationName) || 0
                locationCounts.set(g.locationName, count + 1)
            })

            const topLocations = Array.from(locationCounts.entries())
                .map(([location, count]) => ({ location, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)

            // Session health
            const sessionHealth = await Promise.all(
                sessions.map(async (session) => {
                    const groupCount = await GroupConfig.countDocuments({ sessionId: session.sessionId })
                    return {
                        sessionId: session.sessionId,
                        status: session.status,
                        groupCount,
                        lastActive: session.updatedAt
                    }
                })
            )

            return {
                totalSessions,
                activeSessions,
                totalGroups,
                messagesDeliveredToday,
                messagesFailedToday,
                uptime,
                lastReminderSent,
                deliveryRate,
                topLocations,
                sessionHealth
            }
        } catch (error) {
            logger.error({ error }, 'Failed to get analytics statistics')
            throw error
        }
    }

    /**
     * Get session-specific statistics
     */
    async getSessionStatistics(sessionId: string): Promise<{
        groupCount: number
        messagesDelivered: number
        messagesFailed: number
        deliveryRate: number
    }> {
        try {
            const groupCount = await GroupConfig.countDocuments({ sessionId })
            const stats = await MessageTracker.getStatistics(sessionId, 24)

            return {
                groupCount,
                messagesDelivered: stats.delivered,
                messagesFailed: stats.failed,
                deliveryRate: stats.deliveryRate
            }
        } catch (error) {
            logger.error({ error }, `Failed to get session statistics for ${sessionId}`)
            throw error
        }
    }

    /**
     * Format uptime as human-readable string
     */
    formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)

        const parts: string[] = []
        if (days > 0) parts.push(`${days}d`)
        if (hours > 0) parts.push(`${hours}h`)
        if (minutes > 0) parts.push(`${minutes}m`)

        return parts.join(' ') || '0m'
    }
}
