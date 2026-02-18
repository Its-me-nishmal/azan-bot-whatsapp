import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { District, PrayerTime, Location } from '../types/index.js'
import { getCurrentDateMD, getCurrentTime, normalizePrayerTime } from '../utils/time.js'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TIME_DATA_PATH = join(__dirname, '../../time_data')

// Auto-selected 14 locations (one per district)
export const SELECTED_LOCATIONS = [
    { id: 102, name: 'Kasaragod', district: 'Kasaragod' },
    { id: 206, name: 'Kannur', district: 'Kannur' },
    { id: 303, name: 'Kalpetta', district: 'Wayanad' },
    { id: 408, name: 'Kozhikode North', district: 'Kozhikode' },
    { id: 508, name: 'Malappuram', district: 'Malappuram' },
    { id: 608, name: 'Palakkad', district: 'Palakkad' },
    { id: 707, name: 'Thrissur', district: 'Thrissur' },
    { id: 807, name: 'Kochi', district: 'Ernakulam' },
    { id: 904, name: 'Idukki', district: 'Idukki' },
    { id: 1005, name: 'Kottayam', district: 'Kottayam' },
    { id: 1103, name: 'Alappuzha', district: 'Alappuzha' },
    { id: 1201, name: 'Thiruvalla', district: 'Pathanamthitta' },
    { id: 1309, name: 'Kollam', district: 'Kollam' },
    { id: 1408, name: 'Thiruvananthapuram', district: 'Trivandrum' }
]

export class AzanService {
    private locationsCache = new Map<number, PrayerTime[]>()
    private index: District[] = []

    /**
     * Initialize by fetching index and pre-loading selected locations
     */
    async initialize(): Promise<void> {
        try {
            // Load master index from local file
            const indexPath = join(TIME_DATA_PATH, 'index.json')
            const indexData = readFileSync(indexPath, 'utf-8')
            this.index = JSON.parse(indexData)
            logger.info(`Loaded ${this.index.length} districts from local data`)

            // Pre-load all 14 selected locations
            for (const location of SELECTED_LOCATIONS) {
                await this.getLocationData(location.id)
            }

            logger.info(`✅ Pre-loaded ${SELECTED_LOCATIONS.length} locations`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            logger.error({ error, errorMessage, errorStack }, 'Failed to initialize Azan service')
            throw error
        }
    }

    /**
   * Get prayer time data for a specific location
   */
    async getLocationData(locationId: number): Promise<PrayerTime[]> {
        // Check cache first
        if (this.locationsCache.has(locationId)) {
            return this.locationsCache.get(locationId)!
        }

        try {
            // Load from local file
            const filePath = join(TIME_DATA_PATH, `${locationId}.json`)
            const fileData = readFileSync(filePath, 'utf-8')
            const parsedData = JSON.parse(fileData)

            // Extract the data array (files have structure: { data: [...] })
            let data: PrayerTime[] = Array.isArray(parsedData) ? parsedData : (parsedData.prayer_times || parsedData.data)

            if (!data || !Array.isArray(data)) {
                throw new Error(`Invalid data format for location ${locationId}`)
            }

            // Normalize times to 24-hour format for consistent calculations
            data = data.map(day => ({
                ...day,
                fajr: normalizePrayerTime(day.fajr, 'fajr'),
                sunrise: normalizePrayerTime(day.sunrise, 'sunrise'),
                dhuhr: normalizePrayerTime(day.dhuhr, 'dhuhr'),
                asr: normalizePrayerTime(day.asr, 'asr'),
                maghrib: normalizePrayerTime(day.maghrib, 'maghrib'),
                isha: normalizePrayerTime(day.isha, 'isha')
            }))

            this.locationsCache.set(locationId, data)
            logger.info(`Loaded prayer times for location ${locationId}`)

            return data
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            logger.error({ error, errorMessage, errorStack, locationId }, `Failed to load data for location ${locationId}`)
            throw error
        }
    }

    /**
     * Get prayer times for a specific date
     */
    async getPrayerTimeForDate(locationId: number, date: Date = new Date()): Promise<PrayerTime | null> {
        let data = this.locationsCache.get(locationId)
        if (!data) {
            try {
                data = await this.getLocationData(locationId)
            } catch (error) {
                logger.warn(`Failed to load data for location ${locationId} on demand`)
                return null
            }
        }

        const dateStr = getCurrentDateMD()
        const prayerTime = data.find(p => p.date === dateStr)

        if (!prayerTime) {
            logger.warn(`No prayer time found for ${dateStr} in location ${locationId}`)
        }

        return prayerTime || null
    }

    /**
     * Get today's prayer times for a location
     */
    async getTodaysPrayerTimes(locationId: number): Promise<PrayerTime | null> {
        return this.getPrayerTimeForDate(locationId, new Date())
    }

    /**
     * Get the next upcoming prayer for a location
     */
    async getNextPrayer(locationId: number): Promise<{ name: string; time: string } | null> {
        const prayerTimes = await this.getTodaysPrayerTimes(locationId)
        if (!prayerTimes) {
            return null
        }

        // CRITICAL: Use IST time, not server time
        const currentTimeStr = getCurrentTime()
        const [currentHours, currentMinutes] = currentTimeStr.split(':').map(Number)
        const currentTime = currentHours * 60 + currentMinutes

        const prayers = [
            { name: 'fajr', time: prayerTimes.fajr },
            { name: 'dhuhr', time: prayerTimes.dhuhr },
            { name: 'asr', time: prayerTimes.asr },
            { name: 'maghrib', time: prayerTimes.maghrib },
            { name: 'isha', time: prayerTimes.isha }
        ]

        for (const prayer of prayers) {
            const [hours, minutes] = prayer.time.split(':').map(Number)
            const prayerMinutes = hours * 60 + minutes

            if (prayerMinutes > currentTime) {
                return { name: prayer.name, time: prayer.time }
            }
        }

        // If all prayers have passed, return Fajr for tomorrow
        return { name: 'fajr', time: prayerTimes.fajr }
    }

    /**
     * Find location by name (fuzzy search)
     */
    findLocationByName(searchName: string): { id: number; name: string; district: string } | null {
        const search = searchName.toLowerCase()

        // First check in selected locations
        const found = SELECTED_LOCATIONS.find(loc =>
            loc.name.toLowerCase().includes(search) ||
            loc.district.toLowerCase().includes(search)
        )

        if (found) return found

        // Search in full index
        for (const district of this.index) {
            const location = district.locations.find(loc =>
                loc.name.toLowerCase().includes(search)
            )
            if (location) {
                return {
                    id: location.id,
                    name: location.name,
                    district: district.name
                }
            }
        }

        return null
    }

    /**
     * Get all available locations
     */
    getAllLocations(): Location[] {
        const allLocations: Location[] = []
        for (const district of this.index) {
            allLocations.push(...district.locations)
        }
        return allLocations
    }
}
