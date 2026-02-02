import { MessageTemplate } from '../database/models/MessageTemplate.js'
import { logger } from '../utils/logger.js'

export class TemplateService {
    /**
     * Initialize default templates if they don't exist
     */
    static async initializeDefaults(): Promise<void> {
        try {
            const defaultTemplate = await MessageTemplate.findOne({ isDefault: true })

            if (!defaultTemplate) {
                await MessageTemplate.create({
                    name: 'Default Azan Reminder',
                    description: 'Standard azan reminder message',
                    content: '🕌 *Azan Reminder - {{location}}*\n\n{{prayer}} prayer time is at *{{time}}*\n\nMay Allah accept your prayers. 🤲',
                    variables: ['location', 'prayer', 'time'],
                    isDefault: true
                })

                logger.info('Created default message template')
            }

            // Create additional templates
            const existingTemplates = await MessageTemplate.countDocuments()
            if (existingTemplates === 1) {
                await MessageTemplate.insertMany([
                    {
                        name: 'Simple Reminder',
                        description: 'Minimal azan reminder',
                        content: '🕌 {{prayer}} - {{time}} ({{location}})',
                        variables: ['location', 'prayer', 'time'],
                        isDefault: false
                    },
                    {
                        name: 'Detailed Reminder',
                        description: 'Comprehensive azan notification',
                        content: '🕌 *Azan Time Notification*\n\n📍 Location: {{location}}, {{district}}\n🕐 Prayer: {{prayer}}\n⏰ Time: {{time}}\n\nPlease proceed for prayer.\n\nAssalamu Alaikum ✨',
                        variables: ['location', 'prayer', 'time', 'district'],
                        isDefault: false
                    }
                ])

                logger.info('Created additional message templates')
            }
        } catch (error) {
            logger.error({ error }, 'Failed to initialize message templates')
        }
    }

    /**
     * Get template by name
     */
    static async getTemplate(name: string) {
        return await MessageTemplate.findOne({ name })
    }

    /**
     * Get default template
     */
    static async getDefaultTemplate() {
        return await MessageTemplate.findOne({ isDefault: true })
    }

    /**
     * Get all templates
     */
    static async getAllTemplates() {
        return await MessageTemplate.find().sort({ isDefault: -1, name: 1 })
    }

    /**
     * Format message using template
     */
    static formatMessage(template: string, variables: Record<string, string>): string {
        let message = template

        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g')
            message = message.replace(placeholder, value)
        }

        return message
    }

    /**
     * Create custom template
     */
    static async createTemplate(data: {
        name: string
        description: string
        content: string
        variables: string[]
    }) {
        return await MessageTemplate.create(data)
    }

    /**
     * Update template
     */
    static async updateTemplate(name: string, updates: any) {
        return await MessageTemplate.findOneAndUpdate({ name }, updates, { new: true })
    }

    /**
     * Delete template (if not default)
     */
    static async deleteTemplate(name: string) {
        const template = await MessageTemplate.findOne({ name })

        if (template?.isDefault) {
            throw new Error('Cannot delete default template')
        }

        return await MessageTemplate.findOneAndDelete({ name })
    }
}
