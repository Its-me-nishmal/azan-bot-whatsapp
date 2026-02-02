import { Router } from 'express'
import { GroupConfig } from '../../database/models/GroupConfig.js'
import { SessionManager } from '../../bot/SessionManager.js'
import { logger } from '../../utils/logger.js'

export function createGroupRoutes(sessionManager: SessionManager): Router {
    const router = Router()

    /**
     * POST /api/groups - Add group mapping
     */
    router.post('/', async (req, res) => {
        try {
            const { sessionId, locationId, locationName, groupJid } = req.body

            if (!sessionId || !locationId || !locationName || !groupJid) {
                return res.status(400).json({
                    error: 'sessionId, locationId, locationName, and groupJid are required'
                })
            }

            const config = await GroupConfig.create({
                sessionId,
                locationId,
                locationName,
                groupJid,
                enabled: true
            })

            res.json({
                success: true,
                group: config,
                message: 'Group mapping created successfully'
            })
        } catch (error: any) {
            if (error.code === 11000) {
                return res.status(409).json({ error: 'Group mapping already exists for this location' })
            }
            logger.error({ error }, 'Failed to create group mapping')
            res.status(500).json({ error: 'Failed to create group mapping' })
        }
    })

    /**
     * GET /api/groups/:sessionId - Get groups for specific session
     */
    router.get('/:sessionId', async (req, res) => {
        try {
            const groups = await GroupConfig.find({ sessionId: req.params.sessionId })
            res.json(groups)
        } catch (error) {
            logger.error({ error }, 'Failed to fetch groups')
            res.status(500).json({ error: 'Failed to fetch groups' })
        }
    })

    /**
     * DELETE /api/groups/:id - Remove group mapping
     */
    router.delete('/:id', async (req, res) => {
        try {
            await GroupConfig.findByIdAndDelete(req.params.id)
            res.json({ success: true, message: 'Group mapping deleted successfully' })
        } catch (error) {
            logger.error({ error }, 'Failed to delete group mapping')
            res.status(500).json({ error: 'Failed to delete group mapping' })
        }
    })

    /**
     * GET /api/groups/:sessionId/discover - Get all groups the bot is part of
     */
    router.get('/:sessionId/discover', async (req, res) => {
        try {
            const bot = sessionManager.getSession(req.params.sessionId)

            if (!bot) {
                return res.status(404).json({ error: 'Session not found or not connected' })
            }

            const groups = await bot.getAllGroups()

            const formattedGroups = groups.map(g => ({
                jid: g.id,
                name: g.subject,
                participants: g.participants.length
            }))

            res.json(formattedGroups)
        } catch (error) {
            logger.error({ error }, 'Failed to discover groups')
            res.status(500).json({ error: 'Failed to discover groups' })
        }
    })

    return router
}
