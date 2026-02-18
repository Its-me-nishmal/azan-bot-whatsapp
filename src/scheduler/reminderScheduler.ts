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
    private dailyScheduleSent: Set<string> = new Set() // Track which groups already received today's schedule
    private lastScheduleDate: string = ''
    private followUpMessagesSent: Set<string> = new Set() // Track which groups received follow-up messages

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
            await this.checkAndSendFollowUpMessages()
            await this.checkAndTriggerIshaPoll()
            await this.checkAndSendDailySchedule()

            // Member monitoring for duplicate groups
            const { MemberMonitoringService } = await import('../services/MemberMonitoringService.js')
            await MemberMonitoringService.processMonitoring(this.sessionManager)
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
                    const prayerTime = await this.azanService.getTodaysPrayerTimes(config.locationId)
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
                    const prayerTime = await this.azanService.getTodaysPrayerTimes(config.locationId)
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
     * Get random Malayalam phrase for prayer reminder
     */
    private getRandomMalayalamPhrase(): string {
        const phrases = [
            'ബാങ്ക് കൊടുക്കുന്നു',
            'സമയം ആയി',
            'നമസ്കാര സമയം',
            'നമസ്കാരം ആരംഭിച്ചു',
            'സമയം എത്തി, നമസ്കരിക്കാം',
            'നമസ്കാരത്തിന് തയ്യാറാകൂ',
            'നമസ്കാരത്തിന് വിളി',
            'ബാങ്ക് മുഴങ്ങി',
            'ബാങ്ക് ആരംഭിച്ചു',
            'നമസ്കാരം വേളം',
            'സമയം പ്രവേശിച്ചു',
            'നമസ്കരിക്കാൻ സമയം',
            'നമസ്കാരം വിളിക്കുന്നു',
            'സമയം ആയി 🤲',
            'നമസ്കാര സമയം ആയി',
            'ബാങ്ക് സമയം',
            'നമസ്കാരത്തിന് സമയം ആയി',
            'സമയം എത്തി 🤍',
            'നമസ്കാരം ചെയ്യാം',
            'ബാങ്ക് ആയി',
            'സമയം എത്തി',
            'നമസ്കാര വേളം',
            'നമസ്കാരം ആരംഭിക്കാം',
            'നമസ്കരിക്കാം 🤲',
            'സമയം ആയി, നമസ്കരിക്കാം',
            'നമസ്കാരം സമയം ആയി',
            'ബാങ്ക് വിളിച്ചു',
            'നമസ്കാരത്തിന് തയ്യാറാണ്',
            'സമയം പ്രവേശിച്ചു 🤍',
            'നമസ്കാരത്തിന് വിളിക്കുന്നു'
        ]

        return phrases[Math.floor(Math.random() * phrases.length)]
    }

    /**
     * Format reminder message in Malayalam style
     */
    private formatReminderMessage(location: string, prayer: PrayerName, time: string): string {
        const prayerNamesMalayalam = {
            fajr: 'സുബ്ഹ്',
            dhuhr: 'ദുഹർ',
            asr: 'അസർ',
            maghrib: 'മഗ്റിബ്',
            isha: 'ഇഷാ'
        }

        const displayTime = formatTimeForDisplay(time)
        const randomPhrase = this.getRandomMalayalamPhrase()

        return `🕌 ${prayerNamesMalayalam[prayer]} ${randomPhrase}
${displayTime}`
    }

    /**
     * Check and send daily prayer schedule between 4:00 AM - 4:30 AM with random delays
     */
    private async checkAndSendDailySchedule(): Promise<void> {
        const now = new Date()
        const currentHour = now.getHours()
        const currentMinute = now.getMinutes()
        const { getCurrentDateMD } = await import('../utils/time.js')
        const today = getCurrentDateMD()

        // Reset tracking if it's a new day
        if (this.lastScheduleDate !== today) {
            this.dailyScheduleSent.clear()
            this.lastScheduleDate = today
        }

        // Only run between 4:00 AM and 4:30 AM
        if (currentHour !== 4 || currentMinute > 30) return

        const sessions = this.sessionManager.getAllSessions()

        for (const bot of sessions) {
            try {
                const configs = await GroupConfig.find({
                    sessionId: bot.sessionId,
                    enabled: true
                })

                for (const config of configs) {
                    const groupKey = `${bot.sessionId}:${config.groupJid}:${today}`

                    // Skip if already sent today
                    if (this.dailyScheduleSent.has(groupKey)) continue

                    // Calculate random delay based on group (0-30 minutes)
                    const seed = config.groupJid + today
                    let hash = 0
                    for (let i = 0; i < seed.length; i++) {
                        hash = ((hash << 5) - hash) + seed.charCodeAt(i)
                        hash |= 0
                    }
                    const randomMinute = Math.abs(hash % 31) // 0-30 minutes

                    // Check if it's time for this specific group
                    if (currentMinute === randomMinute) {
                        const prayerTimes = await this.azanService.getTodaysPrayerTimes(config.locationId)
                        if (!prayerTimes) continue

                        const message = this.formatDailyScheduleMessage(config.locationName, prayerTimes)
                        await bot.sendToGroup(config.groupJid, message)

                        this.dailyScheduleSent.add(groupKey)
                        logger.info(`📅 Sent daily schedule to ${config.locationName} at 04:${randomMinute.toString().padStart(2, '0')} (${bot.sessionId})`)
                    }
                }
            } catch (error) {
                logger.error({ error }, `Error sending daily schedule for session ${bot.sessionId}`)
            }
        }
    }

    /**
     * Format daily prayer schedule message
     */
    private formatDailyScheduleMessage(location: string, times: any): string {
        const date = new Date()
        const formattedDate = date.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })

        return `🕌 *TODAY'S PRAYER TIMES* 🕌

📍 *Location:* ${location}
📅 *Date:* ${formattedDate}

*Prayer Schedule:*
🌅 *Fajr (Subh):* ${formatTimeForDisplay(times.fajr)}
☀️ *Dhuhr:* ${formatTimeForDisplay(times.dhuhr)}
🕒 *Asr:* ${formatTimeForDisplay(times.asr)}
🌆 *Maghrib:* ${formatTimeForDisplay(times.maghrib)}
🌙 *Isha:* ${formatTimeForDisplay(times.isha)}

_You will receive automatic reminders at each prayer time._

May Allah guide us all. 🤲`
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        this.isRunning = false
        logger.info('Scheduler stopped')
    }

    /**
     * Get random Malayalam follow-up question
     */
    private getRandomFollowUpQuestion(prayer: PrayerName): string {
        const prayerNamesMalayalam: Record<PrayerName, string> = {
            fajr: 'സുബ്ഹ്',
            dhuhr: 'ദുഹർ',
            asr: 'അസർ',
            maghrib: 'മഗ്റിബ്',
            isha: 'ഇഷാ'
        }

        const name = prayerNamesMalayalam[prayer]

        const phrases = [
            `ഇന്ന് ${name} നിസ്കാരിച്ചോ?`,
            `ഇന്ന് ${name} നിസ്കാരിച്ചോ? 🤲`,
            `ഇന്ന് ${name} നിസ്കാരം ചെയ്തോ?`,
            `${name} നിസ്കാരം കഴിഞ്ഞോ?`,
            `ഇന്ന് ${name} നിസ്കാരം ചെയ്യാമോ?`,
            `ഇന്ന് ${name} നിസ്കാരം ചെയ്തുവോ? 🤍`,
            `ഇന്ന് ${name} നിസ്കാരം ഓർമ്മയുണ്ടോ?`,
            `ഇന്ന് ${name} നിസ്കരിക്കാൻ സമയം കിട്ടിയോ?`,
            `ഇന്ന് ${name} നിസ്കാരം വിട്ടുപോയില്ലല്ലോ?`,
            `ഇന്ന് ${name} നിസ്കാരം ചെയ്യാൻ മറക്കല്ലേ 🤲`,
            `ഇന്ന് ${name} നിസ്കാരം ചെയ്തോ സുഹൃത്തെ?`
        ]

        return phrases[Math.floor(Math.random() * phrases.length)]
    }

    /**
     * Send warm follow-up messages 20–60 minutes after each prayer time
     */
    private async checkAndSendFollowUpMessages(): Promise<void> {
        const currentTime = getCurrentTime()
        const sessions = this.sessionManager.getAllSessions()
        const { getCurrentDateMD, addMinutes } = await import('../utils/time.js')
        const today = getCurrentDateMD()

        // Reset tracking at midnight (reuse lastScheduleDate from daily schedule)
        if (this.lastScheduleDate !== today) {
            this.followUpMessagesSent.clear()
        }

        for (const bot of sessions) {
            try {
                const configs = await GroupConfig.find({
                    sessionId: bot.sessionId,
                    enabled: true
                })

                for (const config of configs) {
                    const prayerTime = await this.azanService.getTodaysPrayerTimes(config.locationId)
                    if (!prayerTime) continue

                    for (const prayer of this.enabledPrayers) {
                        const baseTime = prayerTime[prayer]
                        if (!baseTime) continue

                        const followUpKey = `followup:${bot.sessionId}:${config.groupJid}:${prayer}:${today}`

                        // Skip if already sent today
                        if (this.followUpMessagesSent.has(followUpKey)) continue

                        // Seeded random offset 20–60 minutes per group per prayer
                        const seed = config.groupJid + prayer + today
                        let hash = 0
                        for (let i = 0; i < seed.length; i++) {
                            hash = ((hash << 5) - hash) + seed.charCodeAt(i)
                            hash |= 0
                        }
                        const randomOffset = Math.abs(hash % 41) + 20 // 20–60 min
                        const followUpTime = addMinutes(baseTime, randomOffset)

                        if (currentTime === followUpTime) {
                            const message = this.getRandomFollowUpQuestion(prayer)
                            await bot.sendToGroup(config.groupJid, message)
                            this.followUpMessagesSent.add(followUpKey)
                            logger.info(`💬 Sent follow-up for ${prayer} to ${config.locationName} (+${randomOffset}m) [${bot.sessionId}]`)
                        }
                    }
                }
            } catch (error) {
                logger.error({ error }, `Error sending follow-up messages for session ${bot.sessionId}`)
            }
        }
    }
}
