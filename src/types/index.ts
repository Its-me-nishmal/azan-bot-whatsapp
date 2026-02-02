export interface Location {
    id: number
    name: string
    district?: string
}

export interface District {
    id: number
    name: string
    locations: Location[]
}

export interface PrayerTime {
    date: string // MM-DD format
    fajr: string
    sunrise: string
    dhuhr: string
    asr: string
    maghrib: string
    isha: string
}

export interface GroupConfig {
    sessionId: string
    locationId: number
    locationName: string
    groupJid: string
    enabled: boolean
}

export interface SessionData {
    sessionId: string
    phoneNumber?: string
    status: 'pending' | 'qr-scan' | 'connected' | 'disconnected'
    qrCode?: string
    createdAt: Date
    lastConnected?: Date
}

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export interface NextPrayer {
    name: PrayerName
    time: string
    location: string
}
