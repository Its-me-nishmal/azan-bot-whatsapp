import mongoose, { Schema, Document } from 'mongoose'

export interface IMessageLog extends Document {
    timestamp: Date
    sessionId: string
    recipientJid: string  // group JID or personal number
    recipientType: 'group' | 'personal'
    messageType: 'reminder' | 'command-response' | 'broadcast'
    location?: string
    prayerName?: string
    messageContent: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
    error?: string
    deliveryTimestamp?: Date
    readTimestamp?: Date
}

const messageLogSchema = new Schema<IMessageLog>({
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    recipientJid: {
        type: String,
        required: true,
        index: true
    },
    recipientType: {
        type: String,
        enum: ['group', 'personal'],
        required: true
    },
    messageType: {
        type: String,
        enum: ['reminder', 'command-response', 'broadcast'],
        required: true,
        index: true
    },
    location: {
        type: String
    },
    prayerName: {
        type: String
    },
    messageContent: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent',
        required: true,
        index: true
    },
    error: {
        type: String
    },
    deliveryTimestamp: {
        type: Date
    },
    readTimestamp: {
        type: Date
    }
})

// Compound indexes for common queries
messageLogSchema.index({ sessionId: 1, timestamp: -1 })
messageLogSchema.index({ status: 1, timestamp: -1 })
messageLogSchema.index({ messageType: 1, timestamp: -1 })

// TTL index - auto-delete logs older than 90 days
messageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const MessageLog = mongoose.model<IMessageLog>('MessageLog', messageLogSchema)
