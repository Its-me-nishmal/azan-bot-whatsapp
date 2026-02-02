import dotenv from 'dotenv'
import { connectDatabase } from './database/connection.js'
import { SessionManager } from './bot/SessionManager.js'
import { AzanService } from './services/azanService.js'
import { ReminderScheduler } from './scheduler/reminderScheduler.js'
import { app, httpServer, io } from './server/app.js'
import { WebSocketEventHandler } from './server/websocket/events.js'
import { logger } from './utils/logger.js'

// Load environment variables
dotenv.config()

async function main() {
    try {
        logger.info('🚀 Starting WhatsApp Azan Bot...')

        // 1. Connect to MongoDB
        const mongoUrl = process.env.MONGODB_URL
        if (!mongoUrl) {
            throw new Error('MONGODB_URL environment variable is not set')
        }
        await connectDatabase(mongoUrl)

        // 2. Initialize Azan Service
        const azanService = new AzanService()
        await azanService.initialize()
        logger.info('📍 Azan data loaded for 14 Kerala locations')

        // 3. Initialize Session Manager with Azan Service for message handling
        const sessionManager = new SessionManager(azanService)

        // 4. Initialize WebSocket Event Handlers
        const wsHandler = new WebSocketEventHandler(io, sessionManager, azanService)

        io.on('connection', (socket) => {
            wsHandler.handleConnection(socket)
        })

        logger.info('⚡ WebSocket event handlers initialized')

        // Health check endpoint (only REST endpoint)
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                sessions: sessionManager.getSessionCount(),
                timestamp: new Date().toISOString()
            })
        })

        // 5. Restore existing sessions from database
        await sessionManager.restoreSessionsFromDatabase()

        // 6. Start Reminder Scheduler
        const scheduler = new ReminderScheduler(sessionManager, azanService)
        scheduler.start()

        // 7. Start Web Server
        const PORT = process.env.PORT || 3000
        httpServer.listen(PORT, () => {
            logger.info(`✅ Server running on http://localhost:${PORT}`)
            logger.info(`📱 Open the web interface to manage sessions`)
            logger.info(`⚡ WebSocket ready for real-time updates`)
        })

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully...')
            scheduler.stop()
            process.exit(0)
        })

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error({ error, errorMessage, errorStack }, '❌ Fatal error')
        process.exit(1)
    }
}

main()
