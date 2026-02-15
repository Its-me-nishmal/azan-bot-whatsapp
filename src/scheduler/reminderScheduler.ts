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
            await this.checkAndTriggerIshaPoll()
        })

        this.isRunning = true
        logger.info('⏰ Reminder scheduler started (Timezone: Asia/Kolkata - IST)')
        logger.info(`📅 Enabled prayers: ${this.enabledPrayers.join(', ')}`)
    }

    /**
     * Check if it's time to send the Isha summary poll (20 to 200 minutes range after Isha)
     */
    private async checkAndTriggerIshaPoll(): Promise<void> {
        const currentTime = getCurrentTime()
        const sessions = this.sessionManager.getAllSessions()
        const { getCurrentDateMD, addMinutes } = await import('../utils/time.js')
        const today = getCurrentDateMD()

        for (const bot of sessions) {
            try {
                const configs = await GroupConfig.find({
                    sessionId: bot.sessionId,
                    enabled: true
                })

                for (const config of configs) {
                    const prayerTime = this.azanService.getTodaysPrayerTimes(config.locationId)
                    if (!prayerTime || !prayerTime.isha) continue

                    // Seeded random offset between 20 and 200 minutes
                    // Using groupJid + date as seed to keep it consistent for the day
                    const seed = config.groupJid + today
                    let hash = 0
                    for (let i = 0; i < seed.length; i++) {
                        hash = ((hash << 5) - hash) + seed.charCodeAt(i)
                        hash |= 0 // Convert to 32bit integer
                    }
                    const randomOffset = Math.abs(hash % (200 - 20)) + 20
                    const pollTime = addMinutes(prayerTime.isha, randomOffset)

                    if (currentTime === pollTime) {
                        logger.info(`🎯 Triggering Isha Summary Poll for group ${config.groupJid} (Offset: ${randomOffset}m)`)
                        await this.sendPollToMembers(bot.sessionId, config.groupJid)
                    }
                }
            } catch (error) {
                logger.error({ error }, 'Error in checkAndTriggerIshaPoll')
            }
        }
    }

    /**
     * Send poll to members one-by-one with randomized delay
     */
    private async sendPollToMembers(sessionId: string, groupJid: string): Promise<void> {
        const bot = this.sessionManager.getSession(sessionId)
        if (!bot) return

        try {
            // Get group metadata to find participants
            const groupMetadata = await bot.getAllGroups()
            const group = groupMetadata.find(g => g.id === groupJid)

            if (!group || !group.participants) {
                logger.warn(`No participants found for group ${groupJid}`)
                return
            }

            const prayers = ['🌅 Subh (Fajr)', '☀️ Duhr', '🕒 Asr', '🌆 Magrib', '🌙 Isha']
            const pollName = 'Did you pray today? (Daily Summary)'

            // Send to members one by one with random delay
            for (const participant of group.participants) {
                const jid = participant.id

                // Random delay between 5 to 30 seconds to prevent spam
                const delay = Math.floor(Math.random() * (30000 - 5000 + 1) + 5000)

                setTimeout(async () => {
                    try {
                        await bot.sendPoll(jid, pollName, prayers)
                        logger.info(`✅ Sent daily summary poll to ${jid} (Session: ${sessionId})`)
                    } catch (error) {
                        logger.error({ error, jid }, 'Failed to send poll to member')
                    }
                }, delay)
            }
        } catch (error) {
            logger.error({ error }, `Error sending polls to group ${groupJid}`)
        }
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
