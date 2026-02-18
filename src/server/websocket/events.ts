import { Server, Socket } from 'socket.io'
import { SessionManager } from '../../bot/SessionManager.js'
import { AzanService } from '../../services/azanService.js'
import { GroupConfig } from '../../database/models/GroupConfig.js'
import { Session } from '../../database/models/Session.js'
import { User } from '../../database/models/User.js'
import { authenticateUser, createUser } from '../../services/authService.js'
import { authenticateSocket, requireAuth, checkRateLimit } from '../../middleware/auth.js'
import { validate, sessionSchemas, groupSchemas, authSchemas } from '../../validators/schemas.js'
import { logger } from '../../utils/logger.js'

export class WebSocketEventHandler {
    private io: Server
    private sessionManager: SessionManager
    private azanService: AzanService

    constructor(io: Server, sessionManager: SessionManager, azanService: AzanService) {
        this.io = io
        this.sessionManager = sessionManager
        this.azanService = azanService
    }

    /**
     * Initialize event handlers for a client connection
     */
    handleConnection(socket: Socket): void {
        logger.info(`Client connected: ${socket.id}`)

        const authToken = socket.handshake.auth.token
        if (authToken) {
            authenticateSocket(socket)
        }

        // Authentication Events (no auth required)
        socket.on('auth:login', (data) => this.handleLogin(socket, data))
        socket.on('auth:register', (data) => this.handleRegister(socket, data))

        // Session Events (auth required)
        socket.on('session:create', (data) => {
            if (!requireAuth(socket, 'session:create')) return
            if (!checkRateLimit(socket, 'session:create')) return
            this.handleSessionCreate(socket, data)
        })

        socket.on('session:delete', (data) => {
            if (!requireAuth(socket, 'session:delete')) return
            if (!checkRateLimit(socket, 'session:delete')) return
            this.handleSessionDelete(socket, data)
        })
        socket.on('session:restart', (data) => this.handleSessionRestart(socket, data))
        socket.on('session:list', () => this.handleSessionList(socket))
        socket.on('session:get', (data) => this.handleSessionGet(socket, data))

        // Group Events
        socket.on('group:add', (data) => this.handleGroupAdd(socket, data))
        socket.on('group:list', (data) => this.handleGroupList(socket, data))
        socket.on('group:delete', (data) => this.handleGroupDelete(socket, data))
        socket.on('group:discover', (data) => this.handleGroupDiscover(socket, data))

        // Analytics Events
        socket.on('analytics:get', () => {
            if (!requireAuth(socket, 'analytics:get')) return
            this.handleAnalyticsGet(socket)
        })

        socket.on('analytics:session', (data) => {
            if (!requireAuth(socket, 'analytics:session')) return
            this.handleSessionAnalytics(socket, data)
        })

        // Disconnection
        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`)
        })
    }

    // ============ Authentication Handlers ============

    private async handleLogin(socket: Socket, data: { username: string; password: string }): Promise<void> {
        try {
            const validation = validate(authSchemas.login, data)

            if (validation.error) {
                socket.emit('auth:error', { message: validation.error })
                return
            }

            const { username, password } = validation.value as { username: string; password: string }

            const result = await authenticateUser(username, password)

            if (!result) {
                socket.emit('auth:error', { message: 'Invalid username or password' })
                return
            }

            socket.data.authenticated = true
            socket.data.user = {
                username: result.user.username,
                role: result.user.role
            }

            socket.emit('auth:success', result)
            logger.info(`User logged in via WebSocket: ${username}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Login failed')
            socket.emit('auth:error', { message: 'Login failed. Please try again.' })
        }
    }

    private async handleRegister(socket: Socket, data: { username: string; password: string; role?: 'admin' | 'manager' }): Promise<void> {
        try {
            const validation = validate(authSchemas.register, data)

            if (validation.error) {
                socket.emit('auth:error', { message: validation.error })
                return
            }

            const { username, password, role } = validation.value as { username: string; password: string; role?: 'admin' | 'manager' }

            const existingUser = await User.findOne({ username })
            if (existingUser) {
                socket.emit('auth:error', { message: 'Username already taken' })
                return
            }

            await createUser(username, password, role || 'manager')

            socket.emit('auth:registered', {
                message: 'User registered successfully. Please log in.'
            })

            logger.info(`New user registered via WebSocket: ${username}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Registration failed')
            socket.emit('auth:error', { message: 'Registration failed. Please try again.' })
        }
    }

    // ============ Session Handlers ============

    private async handleSessionCreate(socket: Socket, data: { sessionId: string; phoneNumber?: string }): Promise<void> {
        try {
            const { sessionId, phoneNumber } = data

            if (!sessionId) {
                socket.emit('error', { event: 'session:create', message: 'sessionId is required' })
                return
            }

            await this.sessionManager.createSession(sessionId, phoneNumber)

            socket.emit('session:created', {
                sessionId,
                message: 'Session created successfully. Waiting for QR scan...'
            })

            this.io.emit('session:list:update')

            logger.info(`Session created via WebSocket: ${sessionId}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to create session via WebSocket')
            socket.emit('error', { event: 'session:create', message: errorMessage })
        }
    }

    private async handleSessionDelete(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'session:delete', message: 'sessionId is required' })
                return
            }

            await this.sessionManager.deleteSession(sessionId)

            socket.emit('session:deleted', { sessionId })
            this.io.emit('session:list:update')

            logger.info(`Session deleted via WebSocket: ${sessionId}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to delete session via WebSocket')
            socket.emit('error', { event: 'session:delete', message: errorMessage })
        }
    }

    private async handleSessionRestart(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'session:restart', message: 'sessionId is required' })
                return
            }

            await this.sessionManager.restartSession(sessionId)

            socket.emit('session:restarted', { sessionId })
            this.io.emit('session:list:update')

            logger.info(`Session restarted via WebSocket: ${sessionId}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to restart session via WebSocket')
            socket.emit('error', { event: 'session:restart', message: errorMessage })
        }
    }

    private async handleSessionList(socket: Socket): Promise<void> {
        try {
            const sessions = await Session.find().sort({ createdAt: -1 })
            socket.emit('session:list:response', { sessions })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to fetch sessions via WebSocket')
            socket.emit('error', { event: 'session:list', message: errorMessage })
        }
    }

    private async handleSessionGet(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'session:get', message: 'sessionId is required' })
                return
            }

            const session = await Session.findOne({ sessionId })

            if (!session) {
                socket.emit('error', { event: 'session:get', message: 'Session not found' })
                return
            }

            socket.emit('session:get:response', { session })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to fetch session via WebSocket')
            socket.emit('error', { event: 'session:get', message: errorMessage })
        }
    }

    // ============ Group Handlers ============

    private async handleGroupAdd(socket: Socket, data: {
        sessionId: string
        locationId: number
        locationName: string
        groupJid: string
        groupName?: string
    }): Promise<void> {
        try {
            const { sessionId, locationId, locationName, groupJid, groupName } = data

            if (!sessionId || !locationId || !locationName || !groupJid) {
                socket.emit('error', {
                    event: 'group:add',
                    message: 'sessionId, locationId, locationName, and groupJid are required'
                })
                return
            }

            const config = await GroupConfig.create({
                sessionId,
                locationId,
                locationName,
                groupJid,
                groupName: groupName || '',
                enabled: true
            })

            socket.emit('group:added', { config })
            this.io.emit('group:list:update', { sessionId })

            logger.info(`Group mapping created via WebSocket: ${groupJid} -> ${locationName}`)
        } catch (error: any) {
            if (error.code === 11000) {
                socket.emit('error', {
                    event: 'group:add',
                    message: 'Group mapping already exists for this location'
                })
                return
            }
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to create group mapping via WebSocket')
            socket.emit('error', { event: 'group:add', message: errorMessage })
        }
    }

    private async handleGroupList(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'group:list', message: 'sessionId is required' })
                return
            }

            const groups = await GroupConfig.find({ sessionId })
            socket.emit('group:list:response', { sessionId, groups })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to fetch groups via WebSocket')
            socket.emit('error', { event: 'group:list', message: errorMessage })
        }
    }

    private async handleGroupDelete(socket: Socket, data: { id: string; sessionId?: string }): Promise<void> {
        try {
            const { id, sessionId } = data

            if (!id) {
                socket.emit('error', { event: 'group:delete', message: 'id is required' })
                return
            }

            await GroupConfig.findByIdAndDelete(id)

            socket.emit('group:deleted', { id })
            if (sessionId) {
                this.io.emit('group:list:update', { sessionId })
            }

            logger.info(`Group mapping deleted via WebSocket: ${id}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to delete group mapping via WebSocket')
            socket.emit('error', { event: 'group:delete', message: errorMessage })
        }
    }

    private async handleGroupDiscover(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'group:discover', message: 'sessionId is required' })
                return
            }

            const bot = this.sessionManager.getSession(sessionId)

            if (!bot) {
                socket.emit('error', {
                    event: 'group:discover',
                    message: 'Session not found or not connected'
                })
                return
            }

            const groups = await bot.getAllGroups()

            const formattedGroups = groups.map(g => ({
                jid: g.id,
                name: g.subject,
                participants: g.participants.length
            }))

            socket.emit('group:discover:response', { sessionId, groups: formattedGroups })

            logger.info(`Discovered ${formattedGroups.length} groups via WebSocket for session ${sessionId}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to discover groups via WebSocket')
            socket.emit('error', { event: 'group:discover', message: errorMessage })
        }
    }

    // ============ Analytics Handlers ============

    private async handleAnalyticsGet(socket: Socket): Promise<void> {
        try {
            const { AnalyticsService } = await import('../../services/AnalyticsService.js')
            const analyticsService = new AnalyticsService()

            const stats = await analyticsService.getStatistics()

            socket.emit('analytics:response', { stats })
            logger.debug('Analytics statistics sent')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to get analytics')
            socket.emit('error', { event: 'analytics:get', message: errorMessage })
        }
    }

    private async handleSessionAnalytics(socket: Socket, data: { sessionId: string }): Promise<void> {
        try {
            const { sessionId } = data

            if (!sessionId) {
                socket.emit('error', { event: 'analytics:session', message: 'sessionId is required' })
                return
            }

            const { AnalyticsService } = await import('../../services/AnalyticsService.js')
            const analyticsService = new AnalyticsService()

            const stats = await analyticsService.getSessionStatistics(sessionId)

            socket.emit('analytics:session:response', { sessionId, stats })
            logger.debug(`Session analytics sent for ${sessionId}`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error({ error }, 'Failed to get session analytics')
            socket.emit('error', { event: 'analytics:session', message: errorMessage })
        }
    }
}
