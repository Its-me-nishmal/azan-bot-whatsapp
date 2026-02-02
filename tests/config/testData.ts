/**
 * Test configuration and test data
 */

export const TEST_CONFIG = {
    // Test Group JID (real group for testing)
    groupJid: '120363425088099716@g.us',

    // Test message recipient (real number for testing)
    testNumber: '917994107442@s.whatsapp.net',
    testNumberRaw: '917994107442',

    // Current logged in session
    sessionId: '916235234132',

    // Test location data
    testLocation: {
        id: 807,
        name: 'Kochi',
        district: 'Ernakulam'
    },

    // Test user credentials
    testUser: {
        username: 'testadmin',
        password: 'testpass123',
        role: 'admin' as const
    },

    // Test prayer times
    testPrayerTimes: {
        fajr: '05:30',
        dhuhr: '12:15',
        asr: '15:45',
        maghrib: '18:30',
        isha: '19:45'
    }
}

export const MOCK_QR_CODE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export const MOCK_GROUP_METADATA = {
    id: TEST_CONFIG.groupJid,
    subject: 'Test Azan Group',
    participants: [
        { id: TEST_CONFIG.testNumber, admin: null },
        { id: '916235234132@s.whatsapp.net', admin: 'admin' }
    ]
}
