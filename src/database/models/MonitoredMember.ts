import mongoose from 'mongoose'

const monitoredMemberSchema = new mongoose.Schema({
    userId: {
        type: String, // userJid
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    groupJids: {
        type: [String],
        required: true
    },
    groupNames: {
        type: [String],
        required: true
    },
    warnedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['warned', 'removed'],
        default: 'warned'
    }
}, {
    timestamps: true
})

// Compound index to quickly find if a user in a session is already being monitored
monitoredMemberSchema.index({ userId: 1, sessionId: 1 }, { unique: true })

export const MonitoredMember = mongoose.model('MonitoredMember', monitoredMemberSchema)
