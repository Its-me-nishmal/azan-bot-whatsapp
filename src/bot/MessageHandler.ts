import { WAMessage } from '@whiskeysockets/baileys'
import { AzanService } from '../services/azanService.js'
import { logger } from '../utils/logger.js'
import { getCurrentTime, formatDateIST } from '../utils/time.js'

export class MessageHandler {
    private azanService: AzanService

    constructor(azanService: AzanService) {
        this.azanService = azanService
    }

    /**
     * Process incoming personal messages and respond
     */
    async handleMessage(message: WAMessage, sendReply: (text: string) => Promise<void>): Promise<void> {
        // Extract message text
        const text = this.extractMessageText(message)
        if (!text) return

        const command = text.toLowerCase().trim()

        try {
            // Match command patterns
            if (command === 'help' || command === '/help') {
                await this.sendHelpMessage(sendReply)
            }
            else if (command.startsWith('azan-today-') || command.startsWith('/azan-today-')) {
                await this.handleTodayCommand(command, sendReply)
            }
            else if (command.startsWith('azan-next-') || command.startsWith('/azan-next-')) {
                await this.handleNextCommand(command, sendReply)
            }
            else if (command.startsWith('azan-') || command.startsWith('/azan-')) {
                // Default to today
                await this.handleTodayCommand(command.replace('/azan-', 'azan-today-'), sendReply)
            }
            else if (command === 'locations' || command === '/locations') {
                await this.sendLocationsMessage(sendReply)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            logger.error({ error, errorMessage, errorStack }, 'Failed to handle message')
            await sendReply('❌ Sorry, something went wrong. Please try again.')
        }
    }

    /**
     * Extract text from WhatsApp message
     */
    private extractMessageText(message: WAMessage): string | null {
        return message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            null
    }

    /**
     * Handle azan-today-[location] command
     */
    private async handleTodayCommand(command: string, sendReply: (text: string) => Promise<void>): Promise<void> {
        // Extract location from command
        const locationQuery = command
            .replace('/azan-today-', '')
            .replace('azan-today-', '')
            .replace('/azan-', '')
            .replace('azan-', '')
            .trim()

        if (!locationQuery) {
            await sendReply('❌ Please specify a location.\nExample: azan-today-kozhikode')
            return
        }

        // Find location
        const location = this.azanService.findLocationByName(locationQuery)
        if (!location) {
            await sendReply(`❌ Location "${locationQuery}" not found.\n\nUse "locations" to see available locations.`)
            return
        }

        // Get today's prayer times
        const prayerTimes = this.azanService.getTodaysPrayerTimes(location.id)
        if (!prayerTimes) {
            await sendReply(`❌ Prayer times not available for ${location.name}`)
            return
        }

        const message = `🕌 *Today's Prayer Times*

📍 Location: ${location.name}, ${location.district}
📅 Date: ${formatDateIST(new Date(), 'dd MMM yyyy')}

⏰ Prayer Times:
• Fajr (Dawn): ${prayerTimes.fajr}
• Dhuhr (Noon): ${prayerTimes.dhuhr}
• Asr (Afternoon): ${prayerTimes.asr}
• Maghrib (Sunset): ${prayerTimes.maghrib}
• Isha (Night): ${prayerTimes.isha}

May Allah accept your prayers. 🤲`

        await sendReply(message)
        logger.info(`Sent today's prayer times for ${location.name}`)
    }

    /**
     * Handle azan-next-[location] command
     */
    private async handleNextCommand(command: string, sendReply: (text: string) => Promise<void>): Promise<void> {
        const locationQuery = command
            .replace('/azan-next-', '')
            .replace('azan-next-', '')
            .trim()

        if (!locationQuery) {
            await sendReply('❌ Please specify a location.\nExample: azan-next-kozhikode')
            return
        }

        const location = this.azanService.findLocationByName(locationQuery)
        if (!location) {
            await sendReply(`❌ Location "${locationQuery}" not found.\n\nUse "locations" to see available locations.`)
            return
        }

        const prayerTimes = this.azanService.getTodaysPrayerTimes(location.id)
        if (!prayerTimes) {
            await sendReply(`❌ Prayer times not available for ${location.name}`)
            return
        }

        // Find next prayer
        const currentTime = getCurrentTime()
        const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const

        let nextPrayer: string | null = null
        let nextTime: string | null = null

        for (const prayer of prayers) {
            if (prayerTimes[prayer] > currentTime) {
                nextPrayer = prayer.charAt(0).toUpperCase() + prayer.slice(1)
                nextTime = prayerTimes[prayer]
                break
            }
        }

        if (!nextPrayer) {
            nextPrayer = 'Fajr (Tomorrow)'
            nextTime = prayerTimes.fajr
        }

        const message = `🕌 *Next Prayer Time*

📍 Location: ${location.name}, ${location.district}
⏰ Current Time: ${currentTime}

🔔 Next Prayer: ${nextPrayer}
⏱️ Time: ${nextTime}

May Allah guide us. 🤲`

        await sendReply(message)
        logger.info(`Sent next prayer time for ${location.name}`)
    }

    /**
     * Send help message
     */
    private async sendHelpMessage(sendReply: (text: string) => Promise<void>): Promise<void> {
        const message = `🕌 *WhatsApp Azan Bot - Help*

*Available Commands:*

📍 *azan-today-[location]*
Get today's prayer times for a location
Example: azan-today-kozhikode

🔔 *azan-next-[location]*
Get next prayer time for a location
Example: azan-next-kochi

📋 *locations*
View all 14 available locations

❓ *help*
Show this help message

*Quick Tips:*
• Location names are case-insensitive
• Works with partial names (e.g., "malap" finds Malappuram)
• All times are in 24-hour format (HH:MM)

May Allah bless you! 🤲`

        await sendReply(message)
    }

    /**
     * Send locations list
     */
    private async sendLocationsMessage(sendReply: (text: string) => Promise<void>): Promise<void> {
        const { SELECTED_LOCATIONS } = await import('../services/azanService.js')

        const locationList = SELECTED_LOCATIONS
            .map((loc, index) => `${index + 1}. ${loc.name} (${loc.district})`)
            .join('\n')

        const message = `📍 *Available Locations (14)*

${locationList}

*Usage:*
Send "azan-today-[location]" to get prayer times.
Example: azan-today-kasaragod

May Allah guide you! 🤲`

        await sendReply(message)
    }
}
