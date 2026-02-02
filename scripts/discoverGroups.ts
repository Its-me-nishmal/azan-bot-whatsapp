import dotenv from 'dotenv'
import { SessionManager } from '../src/bot/SessionManager.js'
import { logger } from '../src/utils/logger.js'

dotenv.config()

async function main() {
    logger.info('🔍 Discovering WhatsApp groups...')

    if (!process.env.MONGODB_URL) {
        throw new Error('MONGODB_URL environment variable is not set')
    }

    const { connectDatabase } = await import('../src/database/connection.js')
    await connectDatabase(process.env.MONGODB_URL)

    const sessionManager = new SessionManager()

    // Get session ID from command line
    const sessionId = process.argv[2]

    if (!sessionId) {
        console.log('\n❌ Usage: npm run discover-groups <sessionId>\n')
        console.log('Example: npm run discover-groups +1234567890\n')
        process.exit(1)
    }

    const bot = sessionManager.getSession(sessionId)

    if (!bot || !bot.isConnected()) {
        console.log(`\n❌ Session "${sessionId}" not found or not connected\n`)
        console.log('Make sure the session is created and connected first.\n')
        process.exit(1)
    }

    try {
        const groups = await bot.getAllGroups()

        console.log(`\n✅ Found ${groups.length} groups:\n`)

        groups.forEach((group, index) => {
            console.log(`${index + 1}. ${group.subject}`)
            console.log(`   JID: ${group.id}`)
            console.log(`   Participants: ${group.participants.length}`)
            console.log('')
        })

        console.log('\n💡 To configure a group for a location, use the API:')
        console.log(`
curl -X POST http://localhost:3000/api/groups \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "${sessionId}",
    "locationId": 807,
    "locationName": "Kochi",
    "groupJid": "GROUP_JID_HERE"
  }'
    `)

    } catch (error) {
        logger.error({ error }, '❌ Failed to discover groups')
    }

    process.exit(0)
}

main()
