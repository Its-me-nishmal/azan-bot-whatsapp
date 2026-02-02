import { MessageTracker } from '../../src/services/MessageTracker'
import { MessageLog } from '../../src/database/models/MessageLog'
import { connectDatabase, disconnectDatabase } from '../../src/database/connection'
import { TEST_CONFIG } from '../config/testData'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer: MongoMemoryServer

describe('MessageTracker Integration Tests', () => {
    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create()
        const mongoUri = mongoServer.getUri()

        // Connect to in-memory database
        await connectDatabase(mongoUri)
    })

    afterAll(async () => {
        // Clean up and disconnect
        await MessageLog.deleteMany({})
        await disconnectDatabase()
        await mongoServer.stop()
    })

    beforeEach(async () => {
        // Clear messages before each test
        await MessageLog.deleteMany({})
    })

    describe('logMessage', () => {
        it('should log a group reminder message', async () => {
            const messageData = {
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group' as const,
                messageType: 'reminder' as const,
                messageContent: 'Test reminder message',
                location: 'Kochi',
                prayerName: 'fajr'
            }

            const log = await MessageTracker.logMessage(messageData)

            expect(log).toBeDefined()
            expect(log.sessionId).toBe(TEST_CONFIG.sessionId)
            expect(log.recipientJid).toBe(TEST_CONFIG.groupJid)
            expect(log.status).toBe('sent')
            expect(log.location).toBe('Kochi')
            expect(log.prayerName).toBe('fajr')
        })

        it('should log a personal message', async () => {
            const messageData = {
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.testNumber,
                recipientType: 'personal' as const,
                messageType: 'command-response' as const,
                messageContent: 'Prayer times for Kochi'
            }

            const log = await MessageTracker.logMessage(messageData)

            expect(log).toBeDefined()
            expect(log.recipientType).toBe('personal')
            expect(log.messageType).toBe('command-response')
        })
    })

    describe('updateStatus', () => {
        it('should update message status to delivered', async () => {
            const messageData = {
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group' as const,
                messageType: 'reminder' as const,
                messageContent: 'Test message'
            }

            const log = await MessageTracker.logMessage(messageData)
            await MessageTracker.updateStatus(log._id.toString(), 'delivered')

            const updated = await MessageLog.findById(log._id)
            expect(updated?.status).toBe('delivered')
            expect(updated?.deliveryTimestamp).toBeDefined()
        })

        it('should update message status to failed with error', async () => {
            const messageData = {
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group' as const,
                messageType: 'reminder' as const,
                messageContent: 'Test message'
            }

            const log = await MessageTracker.logMessage(messageData)
            await MessageTracker.updateStatus(log._id.toString(), 'failed', 'Connection timeout')

            const updated = await MessageLog.findById(log._id)
            expect(updated?.status).toBe('failed')
            expect(updated?.error).toBe('Connection timeout')
        })
    })

    describe('getStatistics', () => {
        it('should calculate message statistics correctly', async () => {
            // Create test messages
            await MessageTracker.logMessage({
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: 'Message 1'
            })

            const log2 = await MessageTracker.logMessage({
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: 'Message 2'
            })
            await MessageTracker.updateStatus(log2._id.toString(), 'delivered')

            const log3 = await MessageTracker.logMessage({
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: 'Message 3'
            })
            await MessageTracker.updateStatus(log3._id.toString(), 'failed', 'Error')

            const stats = await MessageTracker.getStatistics(TEST_CONFIG.sessionId)

            expect(stats.total).toBe(3)
            expect(stats.sent).toBe(1)
            expect(stats.delivered).toBe(1)
            expect(stats.failed).toBe(1)
            expect(stats.deliveryRate).toBeGreaterThan(0)
        })
    })

    describe('getTodayMessageCount', () => {
        it('should count today messages correctly', async () => {
            await MessageTracker.logMessage({
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: 'Today message 1'
            })

            await MessageTracker.logMessage({
                sessionId: TEST_CONFIG.sessionId,
                recipientJid: TEST_CONFIG.groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: 'Today message 2'
            })

            const count = await MessageTracker.getTodayMessageCount(TEST_CONFIG.sessionId)
            expect(count).toBe(2)
        })
    })
})
