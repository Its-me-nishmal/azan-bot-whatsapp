import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PUBLIC_PATH = join(__dirname, '../../public')

export const app = express()
export const httpServer = createServer(app)

// Socket.IO with CORS
export const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(PUBLIC_PATH))

// Routes
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: PUBLIC_PATH })
})

logger.info('Express app and Socket.IO server configured')
