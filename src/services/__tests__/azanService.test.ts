import { AzanService, SELECTED_LOCATIONS } from '../azanService'

describe('AzanService', () => {
    let azanService: AzanService

    beforeAll(async () => {
        azanService = new AzanService()
        await azanService.initialize()
    })

    describe('findLocationByName', () => {
        it('should find location by exact name', () => {
            const location = azanService.findLocationByName('Kochi')
            expect(location).toBeDefined()
            expect(location?.name).toBe('Kochi')
            expect(location?.district).toBe('Ernakulam')
        })

        it('should find location by partial name (case insensitive)', () => {
            const location = azanService.findLocationByName('kochi')
            expect(location).toBeDefined()
            expect(location?.name).toBe('Kochi')
        })

        it('should find location by district', () => {
            const location = azanService.findLocationByName('ernakulam')
            expect(location).toBeDefined()
            expect(location?.district).toBe('Ernakulam')
        })

        it('should return null for non-existent location', () => {
            const location = azanService.findLocationByName('NonExistentCity')
            expect(location).toBeNull()
        })
    })

    describe('getPrayerTimeForDate', () => {
        it('should get prayer times for a specific date', () => {
            const date = new Date('2026-02-02')
            const times = azanService.getPrayerTimeForDate(807, date) // Kochi

            expect(times).toBeDefined()
            expect(times?.fajr).toBeDefined()
            expect(times?.dhuhr).toBeDefined()
            expect(times?.asr).toBeDefined()
            expect(times?.maghrib).toBeDefined()
            expect(times?.isha).toBeDefined()
        })

        it('should return null for invalid location ID', () => {
            const date = new Date()
            const times = azanService.getPrayerTimeForDate(99999, date)
            expect(times).toBeNull()
        })
    })

    describe('getNextPrayer', () => {
        it('should calculate next prayer correctly', () => {
            const locationId = 807 // Kochi
            const nextPrayer = azanService.getNextPrayer(locationId)

            expect(nextPrayer).toBeDefined()
            expect(nextPrayer?.name).toMatch(/fajr|dhuhr|asr|maghrib|isha/)
            expect(nextPrayer?.time).toBeDefined()
        })

        it('should return null for invalid location', () => {
            const nextPrayer = azanService.getNextPrayer(99999)
            expect(nextPrayer).toBeNull()
        })
    })

    describe('getSelectedLocations', () => {
        it('should return all 14 selected Kerala locations', () => {
            expect(SELECTED_LOCATIONS).toHaveLength(14)
            expect(SELECTED_LOCATIONS.every(loc => loc.id && loc.name && loc.district)).toBe(true)
        })
    })
})
