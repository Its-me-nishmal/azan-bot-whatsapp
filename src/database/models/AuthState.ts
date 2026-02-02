import mongoose from 'mongoose'

const authStateSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    key: {
        type: String,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
})

// Compound index for fast lookups
authStateSchema.index({ sessionId: 1, key: 1 }, { unique: true })

export const AuthState = mongoose.model('AuthState', authStateSchema)
