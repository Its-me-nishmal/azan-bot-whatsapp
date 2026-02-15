import mongoose, { Schema, Document } from 'mongoose'

export interface IPrayerStats extends Document {
    mobileNumber: string; // The user's WhatsApp JID (phone number)
    date: string; // YYYY-MM-DD
    prayers: {
        fajr: boolean;
        dhuhr: boolean;
        asr: boolean;
        maghrib: boolean;
        isha: boolean;
    };
    updatedAt: Date;
}

const PrayerStatsSchema: Schema = new Schema({
    mobileNumber: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    prayers: {
        fajr: { type: Boolean, default: false },
        dhuhr: { type: Boolean, default: false },
        asr: { type: Boolean, default: false },
        maghrib: { type: Boolean, default: false },
        isha: { type: Boolean, default: false }
    },
    updatedAt: { type: Date, default: Date.now }
})

// Compound index for unique entries per day
PrayerStatsSchema.index({ mobileNumber: 1, date: 1 }, { unique: true })

export const PrayerStats = mongoose.model<IPrayerStats>('PrayerStats', PrayerStatsSchema)
