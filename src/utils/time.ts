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

