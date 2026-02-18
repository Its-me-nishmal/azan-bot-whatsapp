// Socket.IO Connection with authentication
let socket = null
let isAuthenticated = false

// State  
let sessions = []
let currentSessionId = null
let discoveredGroups = []
let groupMappings = []
let locations = []

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('authToken')
    const username = localStorage.getItem('username')

    if (!token || !username) {
        window.location.href = '/login.html'
        return false
    }

    document.getElementById('username-display').textContent = username
    return true
}

// Initialize socket with auth
function initializeSocket() {
    if (!checkAuth()) return

    const token = localStorage.getItem('authToken')

    socket = io({
        auth: {
            token: token
        }
    })

    setupSocketListeners()
}

function setupSocketListeners() {
    // Connection
    socket.on('connect', () => {
        console.log('Connected to server')
        document.getElementById('connection-status').textContent = '🟢 Connected'
        isAuthenticated = true
        loadSessions()
        loadLocations()
        loadAnalytics()
    })

    socket.on('disconnect', () => {
        console.log('Disconnected from server')
        document.getElementById('connection-status').textContent = '🔴 Disconnected'
        isAuthenticated = false
    })

    // Authentication errors
    socket.on('error', (data) => {
        if (data.message === 'Authentication required') {
            localStorage.clear()
            window.location.href = '/login.html'
            return
        }
        console.error('Error:', data)
        showToast(data.message, 'error')
    })

    // Session Event Listeners
    socket.on('session:created', (data) => {
        console.log('Session created:', data)
        showToast(data.message, 'success')
        loadSessions()
    })

    socket.on('session:deleted', (data) => {
        console.log('Session deleted:', data)
        loadSessions()
        if (currentSessionId === data.sessionId) {
            currentSessionId = null
            document.getElementById('session-selector').value = ''
        }
    })

    socket.on('session:restarted', (data) => {
        console.log('Session restarted:', data)
        loadSessions()
    })

    socket.on('session:list:response', (data) => {
        sessions = data.sessions
        displaySessions()
        updateSessionSelector()
    })

    socket.on('session:list:update', () => {
        loadSessions()
    })

    socket.on('qr:update', (data) => {
        console.log('QR updated:', data.sessionId)
        displaySessions()
    })

    socket.on('session:connected', (data) => {
        console.log('Session connected:', data)
        loadSessions()
    })

    socket.on('session:disconnected', (data) => {
        console.log('Session disconnected:', data)
        loadSessions()
    })

    // Group Event Listeners
    socket.on('group:added', (data) => {
        console.log('Group added:', data)
        showToast('Group mapping created successfully!', 'success')
        loadGroupMappings(currentSessionId)
    })

    socket.on('group:deleted', (data) => {
        console.log('Group deleted:', data)
        loadGroupMappings(currentSessionId)
    })

    socket.on('group:list:response', (data) => {
        groupMappings = data.groups
        displayGroupMappings()
    })

    socket.on('group:list:update', (data) => {
        if (data.sessionId === currentSessionId) {
            loadGroupMappings(currentSessionId)
        }
    })

    socket.on('group:discover:response', (data) => {
        discoveredGroups = data.groups
        displayDiscoveredGroups()
    })

    // Analytics Event Listeners
    socket.on('analytics:response', (data) => {
        displayAnalytics(data.stats)
    })

    socket.on('analytics:session:response', (data) => {
        console.log('Session analytics:', data)
    })
}

// ============ Session Functions ============

function createSession() {
    const sessionId = document.getElementById('session-id').value.trim()
    const phoneNumber = document.getElementById('phone-number').value.trim() || undefined

    if (!sessionId) {
        showToast('Please enter a session ID', 'error')
        return
    }

    socket.emit('session:create', { sessionId, phoneNumber })

    // Clear inputs
    document.getElementById('session-id').value = ''
    document.getElementById('phone-number').value = ''
}

function deleteSession(sessionId) {
    if (confirm(`Delete session ${sessionId}?`)) {
        socket.emit('session:delete', { sessionId })
    }
}

function restartSession(sessionId) {
    if (confirm(`Restart session ${sessionId}?`)) {
        socket.emit('session:restart', { sessionId })
    }
}

function loadSessions() {
    if (!socket || !isAuthenticated) return
    socket.emit('session:list', {})
}

function displaySessions() {
    const container = document.getElementById('sessions-list')

    if (sessions.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No sessions yet. Create one above!</p>'
        return
    }

    container.innerHTML = sessions.map(session => {
        const status = session.status
        const statusColor = status === 'connected' ? 'green' : status === 'qr-scan' ? 'yellow' : 'gray'
        const statusIcon = status === 'connected' ? '🟢' : status === 'qr-scan' ? '🟡' : '🔴'

        return `
            <div class="session-card">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-semibold text-lg">${session.sessionId}</h3>
                        <p class="text-sm text-gray-600">${statusIcon} ${status}</p>
                        ${session.phoneNumber ? `<p class="text-sm text-gray-500">${session.phoneNumber}</p>` : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="restartSession('${session.sessionId}')" class="btn-secondary">
                            🔄 Restart
                        </button>
                        <button onclick="deleteSession('${session.sessionId}')" class="btn-danger">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                ${session.qrCode && session.status === 'qr-scan' ? `
                    <div class="mt-4">
                        <p class="text-sm text-gray-600 mb-2">Scan this QR code:</p>
                        <img src="${session.qrCode}" alt="QR Code" class="qr-code">
                    </div>
                ` : ''}
            </div>
        `
    }).join('')
}

function updateSessionSelector() {
    const selector = document.getElementById('session-selector')
    const connectedSessions = sessions.filter(s => s.status === 'connected')

    selector.innerHTML = `
        <option value="">Select a session...</option>
        ${connectedSessions.map(s => `
            <option value="${s.sessionId}">${s.sessionId} (${s.phoneNumber || 'No number'})</option>
        `).join('')}
    `
}

function onSessionSelected() {
    const sessionId = document.getElementById('session-selector').value
    currentSessionId = sessionId

    if (sessionId) {
        document.getElementById('group-section').style.display = 'block'
        loadGroupMappings(sessionId)
        discoveredGroups = []
        displayDiscoveredGroups()
    } else {
        document.getElementById('group-section').style.display = 'none'
    }
}

// ============ Group Functions ============

function loadLocations() {
    // 14 pre-selected Kerala locations
    locations = [
        { id: 102, name: 'Kasaragod', district: 'Kasaragod' },
        { id: 206, name: 'Kannur', district: 'Kannur' },
        { id: 303, name: 'Kalpetta', district: 'Wayanad' },
        { id: 408, name: 'Kozhikode North', district: 'Kozhikode' },
        { id: 503, name: 'Nilambur', district: 'Malappuram' },
        { id: 608, name: 'Palakkad', district: 'Palakkad' },
        { id: 707, name: 'Thrissur', district: 'Thrissur' },
        { id: 807, name: 'Kochi', district: 'Ernakulam' },
        { id: 904, name: 'Idukki', district: 'Idukki' },
        { id: 1005, name: 'Kottayam', district: 'Kottayam' },
        { id: 1103, name: 'Alappuzha', district: 'Alappuzha' },
        { id: 1201, name: 'Thiruvalla', district: 'Pathanamthitta' },
        { id: 1309, name: 'Kollam', district: 'Kollam' },
        { id: 1408, name: 'Thiruvananthapuram', district: 'Thiruvananthapuram' }
    ]

    const locationSelector = document.getElementById('location-selector')
    locationSelector.innerHTML = `
        <option value="">Select location...</option>
        ${locations.map(loc => `
            <option value="${loc.id}" data-name="${loc.name}" data-district="${loc.district}">
                ${loc.name} (${loc.district})
            </option>
        `).join('')}
    `
}

function discoverGroups() {
    if (!currentSessionId) {
        showToast('Please select a session first', 'error')
        return
    }

    socket.emit('group:discover', { sessionId: currentSessionId })
    document.getElementById('discover-status').textContent = 'Discovering groups...'
}

function displayDiscoveredGroups() {
    const container = document.getElementById('discovered-groups')
    const status = document.getElementById('discover-status')

    if (discoveredGroups.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No groups discovered yet. Click "Discover Groups" button.</p>'
        status.textContent = ''
        return
    }

    status.textContent = `Found ${discoveredGroups.length} groups`

    const groupSelector = document.getElementById('group-selector')
    groupSelector.innerHTML = `
        <option value="">Select group...</option>
        ${discoveredGroups.map(g => `
            <option value="${g.jid}">${g.name} (${g.participants} members)</option>
        `).join('')}
    `

    container.innerHTML = `
        <div class="groups-list">
            ${discoveredGroups.map(g => `
                <div class="group-item">
                    <strong>${g.name}</strong>
                    <span class="text-sm text-gray-500">${g.participants} participants</span>
                </div>
            `).join('')}
        </div>
    `
}

function addGroupMapping() {
    const groupSelector = document.getElementById('group-selector')
    const groupJid = groupSelector.value
    const groupName = groupSelector.options[groupSelector.selectedIndex]?.text?.split(' (')[0]?.trim() || groupJid

    const locationId = document.getElementById('location-selector').value
    const locationSelector = document.getElementById('location-selector')
    const selectedOption = locationSelector.options[locationSelector.selectedIndex]

    if (!groupJid || !locationId) {
        showToast('Please select both a group and a location', 'error')
        return
    }

    const locationName = selectedOption.getAttribute('data-name')
    const locationDistrict = selectedOption.getAttribute('data-district')

    socket.emit('group:add', {
        sessionId: currentSessionId,
        locationId: parseInt(locationId),
        locationName: `${locationName}, ${locationDistrict}`,
        groupJid,
        groupName
    })

    // Clear selections
    document.getElementById('group-selector').value = ''
    document.getElementById('location-selector').value = ''
}

function loadGroupMappings(sessionId) {
    if (!socket || !isAuthenticated) return
    socket.emit('group:list', { sessionId })
}

function displayGroupMappings() {
    const container = document.getElementById('group-mappings')

    if (groupMappings.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No group mappings yet. Add one above!</p>'
        return
    }

    container.innerHTML = `
        <table class="mappings-table">
            <thead>
                <tr>
                    <th>Group Name</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${groupMappings.map(mapping => `
                    <tr>
                        <td>
                            <strong>${mapping.groupName || '(No name)'}</strong><br>
                            <code style="font-size:11px;color:#999">${mapping.groupJid}</code>
                        </td>
                        <td>${mapping.locationName}</td>
                        <td>
                            <span class="status-badge ${mapping.enabled ? 'active' : 'inactive'}">
                                ${mapping.enabled ? '✅ Active' : '❌ Inactive'}
                            </span>
                        </td>
                        <td>
                            <button onclick="deleteGroupMapping('${mapping._id}')" class="btn-danger-sm">
                                🗑️ Remove
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `
}

function deleteGroupMapping(id) {
    if (confirm('Remove this group mapping?')) {
        socket.emit('group:delete', { id, sessionId: currentSessionId })
    }
}

// ============ Analytics Functions ============

function loadAnalytics() {
    if (!socket || !isAuthenticated) return
    socket.emit('analytics:get')
}

function displayAnalytics(stats) {
    document.getElementById('stat-sessions').textContent = `${stats.activeSessions}/${stats.totalSessions}`
    document.getElementById('stat-groups').textContent = stats.totalGroups
    document.getElementById('stat-delivered').textContent = stats.messagesDeliveredToday
    document.getElementById('stat-failed').textContent = stats.messagesFailedToday
    document.getElementById('stat-rate').textContent = `${stats.deliveryRate.toFixed(1)}%`
    document.getElementById('stat-uptime').textContent = formatUptime(stats.uptime)

    // Display top locations
    const locationsContainer = document.getElementById('top-locations')
    if (stats.topLocations.length > 0) {
        locationsContainer.innerHTML = stats.topLocations.map(loc => `
            <div class="location-item">
                <span>${loc.location}</span>
                <strong>${loc.count} groups</strong>
            </div>
        `).join('')
    } else {
        locationsContainer.innerHTML = '<p class="text-gray-500">No data yet</p>'
    }

    // Display session health
    const healthContainer = document.getElementById('session-health')
    if (stats.sessionHealth.length > 0) {
        healthContainer.innerHTML = stats.sessionHealth.map(sh => `
            <div class="health-item">
                <div>
                    <strong>${sh.sessionId}</strong><br>
                    <span class="text-sm text-gray-500">${sh.groupCount} groups</span>
                </div>
                <span class="status-badge ${sh.status === 'connected' ? 'active' : 'inactive'}">
                    ${sh.status === 'connected' ? '🟢' : '🔴'} ${sh.status}
                </span>
            </div>
        `).join('')
    } else {
        healthContainer.innerHTML = '<p class="text-gray-500">No sessions yet</p>'
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)

    return parts.join(' ') || '0m'
}

// ============ UI Helpers ============

function showToast(message, type = 'info') {
    // Simple alert for now - can be enhanced with a toast library
    if (type === 'error') {
        alert('❌ ' + message)
    } else {
        alert('✅ ' + message)
    }
}

function logout() {
    localStorage.clear()
    window.location.href = '/login.html'
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket()

    // Auto-refresh sessions every 5 seconds if authenticated
    setInterval(() => {
        if (socket && socket.connected && isAuthenticated) {
            loadSessions()
        }
    }, 5000)

    // Auto-refresh analytics every 30 seconds
    setInterval(() => {
        if (socket && socket.connected && isAuthenticated) {
            loadAnalytics()
        }
    }, 30000)
})
