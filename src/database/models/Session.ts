import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        sparse: true
    },
    status: {
        type: String,
        enum: ['pending', 'qr-scan', 'connected', 'disconnected'],
        default: 'pending'
    },
    qrCode: {
        type: String // Base64 encoded QR code image
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastConnected: {
        type: Date
    }
}, {
    timestamps: true
})

export const Session = mongoose.model('Session', sessionSchema)
