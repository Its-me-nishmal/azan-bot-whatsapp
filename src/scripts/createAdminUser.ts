import dotenv from 'dotenv'
import { connectDB } from '../database/connection.js'
import { createUser } from '../services/authService.js'
import readline from 'readline'

// Load environment variables
dotenv.config()

/**
 * Script to create initial admin user
 * Run: npm run create-admin
 */

async function main() {
    try {
        // Load environment variables
        dotenv.config()

        // Connect to database
        const mongoUrl = process.env.MONGODB_URL
        if (!mongoUrl) {
            console.error('Missing MONGODB_URL environment variable')
            process.exit(1)
        }

        await connectDB(mongoUrl)
        console.log('✅ Connected to database')

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve)
            })
        }

        console.log('\n🔐 Create Admin User\n')

        const username = await question('Enter username: ')
        const password = await question('Enter password (min 6 characters): ')

        if (!username || username.length < 3) {
            console.error('❌ Username must be at least 3 characters')
            process.exit(1)
        }

        if (!password || password.length < 6) {
            console.error('❌ Password must be at least 6 characters')
            process.exit(1)
        }

        // Create admin user
        await createUser(username, password, 'admin')

        console.log(`\n✅ Admin user "${username}" created successfully!`)
        console.log('You can now login at http://localhost:3000/login.html\n')

        rl.close()
        process.exit(0)
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

main()
