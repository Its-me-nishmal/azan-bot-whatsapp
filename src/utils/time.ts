import { format, toZonedTime, fromZonedTime } from 'date-fns-tz'

// CRITICAL: Always use Asia/Kolkata timezone for prayer times
// This ensures correct timing regardless of server deployment location
const TIMEZONE = 'Asia/Kolkata'

/**
 * Get current date/time in IST (Asia/Kolkata timezone)
 */
export function getCurrentDateIST(): Date {
    return toZonedTime(new Date(), TIMEZONE)
}

/**
 * Get current date in MM-DD format for perpetual calendar lookup (in IST)
 */
export function getCurrentDateMD(): string {
    const istDate = getCurrentDateIST()
    return format(istDate, 'MM-dd', { timeZone: TIMEZONE })
}

/**
 * Parse prayer time string (HH:mm) and convert to Date object for today in IST
 */
export function parsePrayerTime(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number)
    const istDate = getCurrentDateIST()
    istDate.setHours(hours, minutes, 0, 0)
    return istDate
}

/**
 * Add minutes to a time string (HH:mm)
 */
export function addMinutes(time: string, minutesToAdd: number): string {
    const date = parsePrayerTime(time)
    date.setMinutes(date.getMinutes() + minutesToAdd)
    return format(date, 'HH:mm', { timeZone: TIMEZONE })
}

/**
 * Get current time in HH:mm format (in IST)
 */
export function getCurrentTime(): string {
    const istDate = getCurrentDateIST()
    return format(istDate, 'HH:mm', { timeZone: TIMEZONE })
}

/**
 * Check if current time matches target time (for scheduler)
 */
export function isTimeMatch(currentTime: string, targetTime: string): boolean {
    return currentTime === targetTime
}

/**
 * Get current timestamp in IST
 */
export function getCurrentTimestamp(): string {
    const istDate = getCurrentDateIST()
    return format(istDate, 'yyyy-MM-dd HH:mm:ss', { timeZone: TIMEZONE })
}

/**
 * Format date for display in IST
 */
export function formatDateIST(date: Date, formatStr: string = 'PPpp'): string {
    const istDate = toZonedTime(date, TIMEZONE)
    return format(istDate, formatStr, { timeZone: TIMEZONE })
}


/**
 * Normalize prayer time to 24-hour format (HH:mm)
 * Handles AM/PM logic based on prayer name
 */
export function normalizePrayerTime(time: string, prayer: string): string {
    let [hours, minutes] = time.split(':').map(Number)
    const prayerName = prayer.toLowerCase()

    // Handle AM/PM logic
    if (['asr', 'maghrib', 'isha'].includes(prayerName)) {
        // These are always PM
        if (hours < 12) hours += 12
    } else if (prayerName === 'dhuhr') {
        // Dhuhr is usually PM (12:xx or 1:xx), but can be AM (11:xx)
        // If it's 1:xx (13:xx), add 12
        if (hours < 11) hours += 12
        // If it's 11:xx, keep as 11 (AM)
        // If it's 12:xx, keep as 12 (PM)
    } else {
        // Fajr, Sunrise are AM
        if (hours === 12) hours = 0 // 12 AM is 00:xx
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Format 24-hour time to 12-hour format with AM/PM
 */
export function formatTimeForDisplay(time: string): string {
    const [hours, minutes] = time.split(':').map(Number)
    const suffix = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${suffix}`
}
