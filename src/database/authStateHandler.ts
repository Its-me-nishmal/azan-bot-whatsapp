import { AuthenticationCreds, SignalDataTypeMap, initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'
import { AuthState } from './models/AuthState.js'
import { logger } from '../utils/logger.js'

/**
 * MongoDB-based auth state handler for Baileys
 * Replaces file-based useMultiFileAuthState with database storage
 */
export async function useMongoDBAuthState(sessionId: string) {
    // Load or initialize credentials
    const creds: AuthenticationCreds = await loadCreds(sessionId) || initAuthCreds()

    return {
        state: {
            creds,
            keys: {
                get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
                    return await loadKeys(sessionId, type, ids)
                },
                set: async (data: any) => {
                    await saveKeys(sessionId, data)
                }
            }
        },
        saveCreds: async () => {
            await saveCreds(sessionId, creds)
        }
    }
}

/**
 * Load credentials from MongoDB
 */
async function loadCreds(sessionId: string): Promise<AuthenticationCreds | null> {
    try {
        const doc = await AuthState.findOne({ sessionId, key: 'creds' })
        if (!doc) return null

        return JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver)
    } catch (error) {
        logger.error({ error }, `Failed to load creds for ${sessionId}`)
        return null
    }
}

/**
 * Save credentials to MongoDB
 */
async function saveCreds(sessionId: string, creds: AuthenticationCreds): Promise<void> {
    try {
        const serialized = JSON.stringify(creds, BufferJSON.replacer)
        await AuthState.findOneAndUpdate(
            { sessionId, key: 'creds' },
            { value: JSON.parse(serialized), updatedAt: new Date() },
            { upsert: true }
        )
    } catch (error) {
        logger.error({ error }, `Failed to save creds for ${sessionId}`)
    }
}

/**
 * Load app-state-sync keys from MongoDB
 */
async function loadKeys(
    sessionId: string,
    type: keyof SignalDataTypeMap,
    ids: string[]
): Promise<any> {
    try {
        const keys: any = {}

        for (const id of ids) {
            const key = `${type}-${id}`
            const doc = await AuthState.findOne({ sessionId, key })

            if (doc) {
                keys[id] = JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver)
            }
        }

        return keys
    } catch (error) {
        logger.error({ error }, `Failed to load keys for ${sessionId}`)
        return {}
    }
}

/**
 * Save app-state-sync keys to MongoDB
 */
async function saveKeys(sessionId: string, data: any): Promise<void> {
    try {
        const operations = []

        for (const type in data) {
            for (const id in data[type]) {
                const key = `${type}-${id}`
                const value = data[type][id]

                if (value === null || value === undefined) {
                    // Delete key
                    operations.push({
                        deleteOne: {
                            filter: { sessionId, key }
                        }
                    })
                } else {
                    // Upsert key
                    const serialized = JSON.stringify(value, BufferJSON.replacer)
                    operations.push({
                        updateOne: {
                            filter: { sessionId, key },
                            update: {
                                $set: {
                                    value: JSON.parse(serialized),
                                    updatedAt: new Date()
                                }
                            },
                            upsert: true
                        }
                    })
                }
            }
        }

        if (operations.length > 0) {
            await AuthState.bulkWrite(operations)
        }
    } catch (error) {
        logger.error({ error }, `Failed to save keys for ${sessionId}`)
    }
}
