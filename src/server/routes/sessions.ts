import { Router } from 'express'
import { SessionManager } from '../../bot/SessionManager.js'
import { Session } from '../../database/models/Session.js'
import { logger } from '../../utils/logger.js'

export function createSessionRoutes(sessionManager: SessionManager): Router {
    const router = Router()

    /**
     * POST /api/sessions - Create new session
     */
    router.post('/', async (req, res) => {
        try {
            const { sessionId, phoneNumber } = req.body

            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId is required' })
            }

            const bot = await sessionManager.createSession(sessionId, phoneNumber)

            res.json({
                success: true,
                sessionId,
                message: 'Session created successfully. Waiting for QR scan...'
            })
        } catch (error) {
            logger.error({ error }, 'Failed to create session')
            res.status(500).json({ error: 'Failed to create session' })
        }
    })

    /**
     * GET /api/sessions - Get all sessions
     */
    router.get('/', async (req, res) => {
        try {
            const sessions = await Session.find().sort({ createdAt: -1 })
            res.json(sessions)
        } catch (error) {
            logger.error({ error }, 'Failed to fetch sessions')
            res.status(500).json({ error: 'Failed to fetch sessions' })
        }
    })

    /**
     * GET /api/sessions/:id - Get specific session
     */
    router.get('/:id', async (req, res) => {
        try {
            const session = await Session.findOne({ sessionId: req.params.id })

            if (!session) {
                return res.status(404).json({ error: 'Session not found' })
            }

            res.json(session)
        } catch (error) {
            logger.error({ error }, 'Failed to fetch session')
            res.status(500).json({ error: 'Failed to fetch session' })
        }
    })

    /**
     * DELETE /api/sessions/:id - Delete session
     */
    router.delete('/:id', async (req, res) => {
        try {
            await sessionManager.deleteSession(req.params.id)
            res.json({ success: true, message: 'Session deleted successfully' })
        } catch (error) {
            logger.error({ error }, 'Failed to delete session')
            res.status(500).json({ error: 'Failed to delete session' })
        }
    })

    /**
     * POST /api/sessions/:id/restart - Restart session
     */
    router.post('/:id/restart', async (req, res) => {
        try {
            await sessionManager.restartSession(req.params.id)
            res.json({ success: true, message: 'Session restarted successfully' })
        } catch (error) {
            logger.error({ error }, 'Failed to restart session')
            res.status(500).json({ error: 'Failed to restart session' })
        }
    })

    return router
}
