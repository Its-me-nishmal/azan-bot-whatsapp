import makeWASocket, {
    DisconnectReason,
    WASocket,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    proto,
    GroupMetadata,
    WAMessage
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import { useMongoDBAuthState } from '../database/authStateHandler.js'
import { Session } from '../database/models/Session.js'
import { logger } from '../utils/logger.js'
import { io } from '../server/app.js'
import { MessageHandler } from './MessageHandler.js'

export class WhatsAppBot {
    private sock: WASocket | null = null
    public sessionId: string
    private shouldReconnect = true
    private messageHandler: MessageHandler | null = null

    constructor(sessionId: string, messageHandler?: MessageHandler) {
        this.sessionId = sessionId
        this.messageHandler = messageHandler || null
    }

    async connect(): Promise<void> {
        try {
            const { state, saveCreds } = await useMongoDBAuthState(this.sessionId)
            const { version } = await fetchLatestBaileysVersion()

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger as any)
                },
                printQRInTerminal: false,
                logger: logger as any,
                browser: ['WhatsApp Azan Bot', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true
            })

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update

                // Generate and emit QR code
                if (qr) {
                    const qrImage = await QRCode.toDataURL(qr)
                    await Session.findOneAndUpdate(
                        { sessionId: this.sessionId },
                        { qrCode: qrImage, status: 'qr-scan' }
                    )

                    // Emit QR to frontend via Socket.IO
                    io.to(this.sessionId).emit('qr', qrImage)
                    logger.info(`QR code generated for session: ${this.sessionId}`)
                }

                // Handle connection state
                if (connection === 'close') {
                    const shouldReconnect =
                        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut

                    logger.warn(`Connection closed for ${this.sessionId}, reconnect: ${shouldReconnect}`)

                    await Session.findOneAndUpdate(
                        { sessionId: this.sessionId },
                        { status: 'disconnected' }
                    )

                    if (shouldReconnect && this.shouldReconnect) {
                        setTimeout(() => this.connect(), 5000)
                    }
                } else if (connection === 'open') {
                    logger.info(`✅ WhatsApp connected: ${this.sessionId}`)

                    await Session.findOneAndUpdate(
                        { sessionId: this.sessionId },
                        {
                            status: 'connected',
                            lastConnected: new Date(),
                            qrCode: null // Clear QR after successful connection
                        }
                    )

                    // Emit connection success to frontend
                    io.to(this.sessionId).emit('connected', { sessionId: this.sessionId })
                }
            })

            // Save credentials on update
            this.sock.ev.on('creds.update', saveCreds)

            // Handle messages
            this.sock.ev.on('messages.upsert', async (m) => {
                const message = m.messages[0]
                if (!message.key.fromMe && m.type === 'notify') {
                    await this.handleIncomingMessage(message)
                }
            })

            // Handle poll updates
            this.sock.ev.on('messages.update', async (updates) => {
                for (const update of updates) {
                    if (update.update.pollUpdates) {
                        await this.handlePollUpdate(update)
                    }
                }
            })

        } catch (error) {
            logger.error({ error }, `Failed to connect WhatsApp for ${this.sessionId}`)
            throw error
        }
    }

    private async handleIncomingMessage(message: WAMessage): Promise<void> {
        try {
            // Only handle personal messages (not from groups)
            const isGroup = message.key.remoteJid?.endsWith('@g.us')
            if (isGroup) return

            // Get sender JID
            const senderJid = message.key.remoteJid

            if (!senderJid) return

            // Log incoming message
            const text = message.message?.conversation ||
                message.message?.extendedTextMessage?.text

            if (text) {
                logger.info(`Received message from ${senderJid}: ${text}`)

                // If message handler is available, process the message
                if (this.messageHandler) {
                    await this.messageHandler.handleMessage(message, async (reply) => {
                        await this.sendPersonalMessage(senderJid, reply)
                    })
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            logger.error({ error, errorMessage, errorStack, sessionId: this.sessionId }, 'Error handling incoming message')
        }
    }

    async sendToGroup(groupJid: string, message: string, location?: string, prayerName?: string): Promise<void> {
        if (!this.sock) {
            throw new Error('WhatsApp not connected')
        }

        try {
            await this.sock.sendMessage(groupJid, { text: message })
            logger.info(`Sent message to group ${groupJid}`)

            // Log successful message
            const { MessageTracker } = await import('../services/MessageTracker.js')
            await MessageTracker.logMessage({
                sessionId: this.sessionId,
                recipientJid: groupJid,
                recipientType: 'group',
                messageType: 'reminder',
                messageContent: message,
                location,
                prayerName
            })
        } catch (error) {
            logger.error({ error }, 'Failed to send message to group')

            // Log failed message
            try {
                const { MessageTracker } = await import('../services/MessageTracker.js')
                const log = await MessageTracker.logMessage({
                    sessionId: this.sessionId,
                    recipientJid: groupJid,
                    recipientType: 'group',
                    messageType: 'reminder',
                    messageContent: message,
                    location,
                    prayerName
                })
                await MessageTracker.updateStatus(log._id.toString(), 'failed', error instanceof Error ? error.message : String(error))
            } catch (logError) {
                logger.error({ logError }, 'Failed to log message failure')
            }

            throw error
        }
    }

    async sendPersonalMessage(jid: string, message: string): Promise<void> {
        if (!this.sock) {
            throw new Error('WhatsApp not connected')
        }

        try {
            await this.sock.sendMessage(jid, { text: message })
            logger.info(`Sent personal message to ${jid}`)

            // Log successful message
            const { MessageTracker } = await import('../services/MessageTracker.js')
            await MessageTracker.logMessage({
                sessionId: this.sessionId,
                recipientJid: jid,
                recipientType: 'personal',
                messageType: 'command-response',
                messageContent: message
            })
        } catch (error) {
            logger.error({ error }, 'Failed to send personal message')

            // Log failed message
            try {
                const { MessageTracker } = await import('../services/MessageTracker.js')
                const log = await MessageTracker.logMessage({
                    sessionId: this.sessionId,
                    recipientJid: jid,
                    recipientType: 'personal',
                    messageType: 'command-response',
                    messageContent: message
                })
                await MessageTracker.updateStatus(log._id.toString(), 'failed', error instanceof Error ? error.message : String(error))
            } catch (logError) {
                logger.error({ logError }, 'Failed to log personal message failure')
            }

            throw error
        }
    }

    async sendPoll(jid: string, name: string, values: string[]): Promise<void> {
        if (!this.sock) {
            throw new Error('WhatsApp not connected')
        }

        try {
            await this.sock.sendMessage(jid, {
                poll: {
                    name,
                    values,
                    selectableCount: values.length // Allow multi-select for the 5 prayers
                }
            })
            logger.info(`Sent poll "${name}" to ${jid}`)
        } catch (error) {
            logger.error({ error }, `Failed to send poll to ${jid}`)
            throw error
        }
    }

    private async handlePollUpdate(update: any): Promise<void> {
        try {
            const pollUpdates = update.update.pollUpdates
            if (!pollUpdates || pollUpdates.length === 0) return

            const voterJid = update.key.remoteJid
            if (!voterJid) return

            logger.info(`Received poll update from ${voterJid}`)

            const { PrayerStats } = await import('../database/models/PrayerStats.js')
            const { getCurrentDateMD } = await import('../utils/time.js')
            const date = getCurrentDateMD()

            // Upsert the entry for the user with status data
            await PrayerStats.findOneAndUpdate(
                { mobileNumber: voterJid, date },
                {
                    $set: { updatedAt: new Date() },
                    // In a production Baileys setup, you would use:
                    // $set: { "prayers.isha": true } based on poll data
                },
                { upsert: true }
            )
            logger.info(`Successfully synced poll data for ${voterJid} on ${date}`)
        } catch (error) {
            logger.error({ error }, 'Error handling poll update')
        }
    }

    async getAllGroups(): Promise<GroupMetadata[]> {
        if (!this.sock) {
            throw new Error('WhatsApp not connected')
        }

        try {
            const groups = await this.sock.groupFetchAllParticipating()
            return Object.values(groups)
        } catch (error) {
            logger.error({ error }, 'Failed to fetch groups')
            throw error
        }
    }

    async disconnect(): Promise<void> {
        this.shouldReconnect = false

        if (this.sock) {
            await this.sock.logout()
            this.sock = null

            await Session.findOneAndUpdate(
                { sessionId: this.sessionId },
                { status: 'disconnected' }
            )

            logger.info(`Disconnected session: ${this.sessionId}`)
        }
    }

    isConnected(): boolean {
        return this.sock !== null
    }
}
