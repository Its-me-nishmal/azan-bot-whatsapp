import cron from 'node-cron'
import { SessionManager } from '../bot/SessionManager.js'
import { AzanService } from '../services/azanService.js'
import { GroupConfig } from '../database/models/GroupConfig.js'
import { getCurrentTime, formatTimeForDisplay } from '../utils/time.js'
import { PrayerName } from '../types/index.js'
import { logger } from '../utils/logger.js'

export class ReminderScheduler {
    private sessionManager: SessionManager
    private azanService: AzanService
    private isRunning = false
    private enabledPrayers: PrayerName[]

    constructor(sessionManager: SessionManager, azanService: AzanService) {
        this.sessionManager = sessionManager
        this.azanService = azanService

        // Get enabled prayers from environment
        const prayersStr = process.env.ENABLED_PRAYERS || 'fajr,dhuhr,asr,maghrib,isha'
        this.enabledPrayers = prayersStr.split(',').map(p => p.trim()) as PrayerName[]
    }

    /**
     * Start the cron scheduler
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Scheduler is already running')
            return
        }

        // Run every minute
        cron.schedule('* * * * *', async () => {
            await this.checkAndSendReminders()
        })

        this.isRunning = true
        logger.info('⏰ Reminder scheduler started (Timezone: Asia/Kolkata - IST)')
        logger.info(`📅 Enabled prayers: ${this.enabledPrayers.join(', ')}`)
    }

    /**
     * Check all sessions and send reminders if prayer time matches
     */
    private async checkAndSendReminders(): Promise<void> {
        const currentTime = getCurrentTime()
        const sessions = this.sessionManager.getAllSessions()

        for (const bot of sessions) {
            try {
                // Get group configs for this session
                const configs = await GroupConfig.find({
                    sessionId: bot.sessionId,
                    enabled: true
                })

                for (const config of configs) {
                    // Get today's prayer times
                    const prayerTime = this.azanService.getTodaysPrayerTimes(config.locationId)
                    if (!prayerTime) continue

                    // Check each enabled prayer
                    for (const prayer of this.enabledPrayers) {
                        if (prayerTime[prayer] === currentTime) {
                            await this.sendReminder(bot.sessionId, config.groupJid, config.locationName, prayer, prayerTime[prayer])
                        }
                    }
                }
            } catch (error) {
                logger.error({ error }, `Error checking reminders for session ${bot.sessionId}`)
            }
        }
    }

    /**
     * Send reminder message to WhatsApp group
     */
    private async sendReminder(
        sessionId: string,
        groupJid: string,
        locationName: string,
        prayer: PrayerName,
        time: string
    ): Promise<void> {
        try {
            const bot = this.sessionManager.getSession(sessionId)
            if (!bot) {
                logger.warn(`Session ${sessionId} not found`)
                return
            }

            const message = this.formatReminderMessage(locationName, prayer, time)
            await bot.sendToGroup(groupJid, message, locationName, prayer)

            logger.info(`✅ Sent ${prayer} reminder to ${locationName} (${sessionId})`)
        } catch (error) {
            logger.error({ error }, 'Failed to send reminder')
        }
    }

    /**
     * Format reminder message
     */
    private formatReminderMessage(location: string, prayer: PrayerName, time: string): string {
        const prayerNames = {
            fajr: 'Fajr (Dawn)',
            dhuhr: 'Dhuhr (Noon)',
            asr: 'Asr (Afternoon)',
            maghrib: 'Maghrib (Sunset)',
            isha: 'Isha (Night)'
        }

        const displayTime = formatTimeForDisplay(time)

        return `🕌 *AZAN REMINDER* 🕌
    
    📍 Location: ${location}
    🕐 Prayer: ${prayerNames[prayer]}
    ⏰ Time: ${displayTime}
    
    May Allah accept your prayers. 🤲`
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        this.isRunning = false
        logger.info('Scheduler stopped')
    }
}
