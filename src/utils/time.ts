import { format } from 'date-fns'

/**
 * Get current date in MM-DD format for perpetual calendar lookup
 */
export function getCurrentDateMD(): string {
    return format(new Date(), 'MM-dd')
}

/**
 * Parse prayer time string (HH:mm) and convert to Date object for today
 */
export function parsePrayerTime(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date
}

/**
 * Add minutes to a time string (HH:mm)
 */
export function addMinutes(time: string, minutesToAdd: number): string {
    const date = parsePrayerTime(time)
    date.setMinutes(date.getMinutes() + minutesToAdd)
    return format(date, 'HH:mm')
}

/**
 * Get current time in HH:mm format
 */
export function getCurrentTime(): string {
    return format(new Date(), 'HH:mm')
}

/**
 * Check if current time matches target time (for scheduler)
 */
export function isTimeMatch(currentTime: string, targetTime: string): boolean {
    return currentTime === targetTime
}
