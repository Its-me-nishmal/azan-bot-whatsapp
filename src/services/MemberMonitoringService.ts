import { GroupConfig } from '../database/models/GroupConfig.js'
import { MonitoredMember } from '../database/models/MonitoredMember.js'
import { logger } from '../utils/logger.js'
import { SessionManager } from '../bot/SessionManager.js'

interface GroupInfo {
    jid: string
    name: string
}

export class MemberMonitoringService {

    // Numbers exempt from duplicate group enforcement (e.g. admins)
    // Format: WhatsApp JID without '+' prefix, with @s.whatsapp.net suffix
    private static readonly EXEMPT_NUMBERS: Set<string> = new Set([
        '917994107442@s.whatsapp.net'
    ])

    private static isExempt(userJid: string): boolean {
        return this.EXEMPT_NUMBERS.has(userJid)
    }

    /**
     * Handle participant updates (e.g. someone joining a group)
     */
    static async handleParticipantUpdate(bot: any, update: any) {
        try {
            const { id: groupJid, participants, action } = update as { id: string, participants: string[], action: string }

            // Only care about adds (joins)
            if (action !== 'add') return

            // Check if this group is mapped
            const isMapped = await GroupConfig.exists({ sessionId: bot.sessionId, groupJid, enabled: true })
            if (!isMapped) return

            logger.info(`Checking duplicates for ${participants.length} new members in group ${groupJid}`)

            for (const userJid of participants) {
                // Skip the bot itself
                if (userJid.includes(':')) continue
                // Skip exempt numbers (admins)
                if (this.isExempt(userJid)) continue
                await this.checkUserDuplicates(bot, userJid)
            }
        } catch (error) {
            logger.error({ error }, 'Error in handleParticipantUpdate')
        }
    }

    /**
     * Check if a specific user is in multiple mapped groups
     */
    static async checkUserDuplicates(bot: any, userJid: string) {
        try {
            // Find all mapped groups for this session
            const mappedConfigs = await GroupConfig.find({ sessionId: bot.sessionId, enabled: true })
            const mappedGroupJids = mappedConfigs.map((c: any) => c.groupJid)

            const userGroups: GroupInfo[] = []

            // Fetch all participating groups
            const allGroups = await bot.getAllGroups()

            for (const group of allGroups) {
                if (mappedGroupJids.includes(group.id)) {
                    const isMember = group.participants.some((p: any) => p.id === userJid)
                    if (isMember) {
                        userGroups.push({ jid: group.id, name: group.subject })
                    }
                }
            }

            if (userGroups.length > 1) {
                await this.handleViolation(bot, userJid, userGroups)
            } else {
                // If user was previously monitored but now fixed it, remove from monitoring
                await MonitoredMember.deleteOne({ userId: userJid, sessionId: bot.sessionId })
            }
        } catch (error) {
            logger.error({ error, userJid }, 'Error checking user duplicates')
        }
    }

    /**
     * Handle the violation: warn or remove
     */
    private static async handleViolation(bot: any, userJid: string, groups: GroupInfo[]) {
        try {
            const groupNames = groups.map((g: GroupInfo) => g.name).join(', ')
            const groupJids = groups.map((g: GroupInfo) => g.jid)

            // Check if already being monitored
            const existing = await MonitoredMember.findOne({ userId: userJid, sessionId: bot.sessionId })

            if (!existing) {
                // First time detection: Send warning
                const message = `⚠️ *DUPLICATE GROUP DETECTION* ⚠️\n\nYou are detected in multiple Azan reminder groups: *${groupNames}*.\n\nPlease kindly leave from one, otherwise you will be *automatically removed from ALL* of them in 30 minutes.`

                await bot.sendPersonalMessage(userJid, message)

                await MonitoredMember.create({
                    userId: userJid,
                    sessionId: bot.sessionId,
                    groupJids,
                    groupNames: groups.map(g => g.name),
                    warnedAt: new Date(),
                    status: 'warned'
                })

                logger.info(`Warned user ${userJid} for being in multiple groups: ${groupNames}`)
            } else {
                // Already warned. Check if 30 minutes passed
                const now = new Date()
                const warnedAt = new Date(existing.warnedAt)
                const diffMs = now.getTime() - warnedAt.getTime()
                const diffMins = Math.floor(diffMs / 60000)

                if (diffMins >= 30 && existing.status === 'warned') {
                    // Time's up! Remove from all groups
                    logger.info(`Removing user ${userJid} from groups after 30 mins: ${groupNames}`)

                    for (const group of groups) {
                        try {
                            await bot.removeFromGroup(group.jid, [userJid])
                        } catch (err) {
                            logger.error({ err, groupJid: group.jid, userJid }, 'Failed to remove user from group')
                        }
                    }

                    await bot.sendPersonalMessage(userJid, `🚫 You have been removed from the groups: *${groupNames}* because you did not leave one within 30 minutes of the warning.`)

                    existing.status = 'removed'
                    await existing.save()
                }
            }
        } catch (error) {
            logger.error({ error, userJid }, 'Error handling violation')
        }
    }

    private static nextScanTime: number = 0

    /**
     * Periodic task to check all sessions for duplicates and process monitoring queue
     */
    static async processMonitoring(sessionManager: SessionManager) {
        try {
            const bots = sessionManager.getAllSessions()
            for (const bot of bots) {
                if (!bot.isConnected()) continue

                // 1. Scan all mapped groups for duplicates (ONLY IF RANDOM DELAY PASSED)
                const now = Date.now()
                if (now >= this.nextScanTime) {
                    logger.info(`Starting random periodic full scan for duplicates (Session: ${bot.sessionId})`)
                    await this.scanAllGroups(bot)

                    // Set next scan to a random time between 1 to 3 hours from now
                    const hours = Math.random() * (3 - 1) + 1
                    this.nextScanTime = now + (hours * 60 * 60 * 1000)
                    logger.info(`Next full scan scheduled in ${hours.toFixed(2)} hours`)
                }

                // 2. Process existing monitored members (removal check - still runs every minute)
                const monitored = await MonitoredMember.find({ sessionId: bot.sessionId, status: 'warned' })
                for (const member of monitored) {
                    await this.handleViolation(bot, member.userId, (member.groupJids as string[]).map((jid: string, i: number) => ({ jid, name: member.groupNames[i] })))
                }
            }
        } catch (error) {
            logger.error({ error }, 'Error in periodic monitoring process')
        }
    }

    private static async scanAllGroups(bot: any) {
        try {
            const mappedConfigs = await GroupConfig.find({ sessionId: bot.sessionId, enabled: true })
            const mappedGroupJids = mappedConfigs.map((c: any) => c.groupJid)
            if (mappedGroupJids.length <= 1) return

            const allGroups = await bot.getAllGroups()
            const mappedGroups = allGroups.filter((g: any) => mappedGroupJids.includes(g.id))

            // Map userJid -> list of groups they are in
            const userGroupsMap = new Map<string, GroupInfo[]>()

            for (const group of mappedGroups) {
                for (const participant of group.participants) {
                    const userJid = participant.id
                    if (userJid.includes(':')) continue // Skip bot

                    if (!userGroupsMap.has(userJid)) {
                        userGroupsMap.set(userJid, [])
                    }
                    userGroupsMap.get(userJid)!.push({ jid: group.id, name: group.subject })
                }
            }

            // Check for violators
            for (const [userJid, groups] of userGroupsMap.entries()) {
                // Skip exempt numbers (admins)
                if (this.isExempt(userJid)) continue

                if (groups.length > 1) {
                    await this.handleViolation(bot, userJid, groups)
                } else {
                    // Check if they were previously violating and now fixed it
                    await MonitoredMember.deleteOne({ userId: userJid, sessionId: bot.sessionId, status: 'warned' })
                }
            }
        } catch (error) {
            logger.error({ error, sessionId: bot.sessionId }, 'Error scanning all groups for duplicates')
        }
    }
}
