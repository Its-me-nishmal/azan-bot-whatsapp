import mongoose from 'mongoose'

const groupConfigSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    locationId: {
        type: Number,
        required: true
    },
    locationName: {
        type: String,
        required: true
    },
    groupJid: {
        type: String,
        required: true
    },
    groupName: {
        type: String,
        default: ''
    },
    enabled: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
})

// Ensure one group per location per session
groupConfigSchema.index({ sessionId: 1, locationId: 1 }, { unique: true })

export const GroupConfig = mongoose.model('GroupConfig', groupConfigSchema)
