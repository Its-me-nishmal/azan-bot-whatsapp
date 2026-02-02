# 🕌 WhatsApp Azan Bot

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)

**Automated Prayer Time Notifications for WhatsApp Groups**

*Delivering accurate Azan reminders to Muslim communities across Kerala, India* 🌙

[Features](#-features) • [Installation](#-installation) • [Configuration](#%EF%B8%8F-configuration) • [Usage](#-usage) • [API](#-api-documentation)

</div>

---

## 📖 Overview

WhatsApp Azan Bot is a powerful, multi-session automation system that sends precise Islamic prayer time notifications to WhatsApp groups. Built with TypeScript and Baileys, it manages multiple WhatsApp sessions simultaneously, each capable of serving different groups with location-specific prayer times across Kerala's 14 districts.

### 🎯 Key Highlights

- **Multi-Session Management**: Run multiple WhatsApp instances simultaneously
- **14 Kerala Locations**: Pre-configured with accurate prayer times for all Kerala districts
- **Real-Time Notifications**: Automatic Azan reminders sent at precise prayer times
- **Web Dashboard**: Beautiful admin interface for session and group management
- **Secure Authentication**: JWT-based auth with role-based access control
- **Message Tracking**: Analytics dashboard with delivery statistics
- **Auto-Reconnection**: Resilient connection handling with automatic recovery

---

## ✨ Features

### 🤖 WhatsApp Automation
- **Multi-session support** - Manage unlimited WhatsApp bot instances
- **QR code authentication** - Easy setup via web interface
- **Auto-reconnection** - Handles disconnections gracefully
- **Group discovery** - Automatically detect all groups for each session
- **Message delivery tracking** - Monitor sent/failed messages

### 🕒 Prayer Time Management
- **365-day prayer times** - Pre-loaded data for entire year
- **14 Kerala locations** - Covering all districts
- **5 daily prayers** - Fajr, Dhuhr, Asr, Maghrib, Isha
- **Sunrise times** - Included for Ishraq prayers
- **Perpetual calendar** - Year-independent MM-DD format

### 🎛️ Admin Dashboard
- **Real-time status** - WebSocket-powered live updates
- **Session management** - Create, restart, delete sessions
- **Group mapping** - Assign locations to WhatsApp groups
- **Analytics** - Delivery rates, uptime, and statistics
- **Secure access** - JWT authentication with role-based permissions

### 🔐 Security & Validation
- **JWT authentication** - Industry-standard token-based auth
- **Input validation** - Joi schemas for all API requests
- **Rate limiting** - Protection against spam/abuse
- **Password hashing** - Bcrypt encryption for user credentials
- **Role-based access** - Admin and manager roles

---

## 🏗️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5.7 |
| **WhatsApp** | @whiskeysockets/baileys |
| **Database** | MongoDB (Mongoose ODM) |
| **Web Server** | Express.js |
| **Real-time** | Socket.IO |
| **Authentication** | JWT, Bcrypt |
| **Validation** | Joi |
| **Scheduler** | node-cron |
| **Testing** | Jest, Supertest |
| **Logging** | Pino |

---

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **MongoDB** Atlas account or local instance
- **WhatsApp** account(s) for bot sessions

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/cipherNichu/whatsapp-azan-bot.git
   cd whatsapp-azan-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Create admin user**
   ```bash
   npm run create-admin
   ```

6. **Start the server**
   ```bash
   npm start
   ```

7. **Access the dashboard**
   ```
   Open http://localhost:3000 in your browser
   ```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/azanbot?retryWrites=true&w=majority

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRY=7d

# WhatsApp Session Storage
SESSION_DIR=./auth_info

# Logging
LOG_LEVEL=info
```

### Prayer Time Locations

The bot comes pre-configured with 14 Kerala locations:

| ID | Location | District |
|----|----------|----------|
| 102 | Kasaragod | Kasaragod |
| 206 | Kannur | Kannur |
| 303 | Kalpetta | Wayanad |
| 408 | Kozhikode North | Kozhikode |
| 508 | Malappuram | Malappuram |
| 608 | Palakkad | Palakkad |
| 707 | Thrissur | Thrissur |
| 807 | Kochi | Ernakulam |
| 904 | Idukki | Idukki |
| 1005 | Kottayam | Kottayam |
| 1103 | Alappuzha | Alappuzha |
| 1201 | Thiruvalla | Pathanamthitta |
| 1309 | Kollam | Kollam |
| 1408 | Thiruvananthapuram | Trivandrum |

---

## 🚀 Usage

### 1. Create a WhatsApp Session

1. Navigate to http://localhost:3000
2. Login with your admin credentials
3. Enter a session ID (e.g., `+919876543210`)
4. Click "Create Session"
5. Scan the QR code with WhatsApp mobile app
6. Wait for "Connected" status

### 2. Map Groups to Locations

1. Select your connected session from the dropdown
2. Click "Discover Groups" to fetch all groups
3. Select a WhatsApp group
4. Choose the prayer time location
5. Click "Add Mapping"

### 3. Prayer Times Are Now Automated! 🎉

The bot will automatically send Azan notifications to mapped groups at the appropriate times.

---

## 📡 API Documentation

### Authentication

#### Register User
```http
POST /auth/register (via WebSocket)
{
  "username": "admin",
  "password": "securepassword",
  "role": "admin"
}
```

#### Login
```http
POST /auth/login (via WebSocket)
{
  "username": "admin",
  "password": "securepassword"
}
```

### Session Management

#### Create Session
```javascript
socket.emit('session:create', {
  sessionId: '+919876543210',
  phoneNumber: 'Kerala Azan Bot'
})
```

#### List Sessions
```javascript
socket.emit('session:list', {})
```

#### Delete Session
```javascript
socket.emit('session:delete', {
  sessionId: '+919876543210'
})
```

### Group Management

#### Discover Groups
```javascript
socket.emit('group:discover', {
  sessionId: '+919876543210'
})
```

#### Add Group Mapping
```javascript
socket.emit('group:add', {
  sessionId: '+919876543210',
  locationId: 807,
  locationName: 'Kochi, Ernakulam',
  groupJid: '120363123456789@g.us'
})
```

---

## 📁 Project Structure

```
whatsapp-azan-bot/
├── src/
│   ├── bot/                    # WhatsApp bot logic
│   │   ├── SessionManager.ts   # Multi-session orchestration
│   │   └── WhatsAppBot.ts      # Core bot functionality
│   ├── database/               # MongoDB models & handlers
│   │   ├── models/             # Mongoose schemas
│   │   └── connection.ts       # DB initialization
│   ├── middleware/             # Express & Socket.IO middleware
│   │   └── auth.ts             # JWT authentication
│   ├── scheduler/              # Cron jobs for prayer times
│   │   └── reminderScheduler.ts
│   ├── server/                 # Web server & API
│   │   ├── websocket/          # Socket.IO event handlers
│   │   └── app.ts              # Express configuration
│   ├── services/               # Business logic
│   │   ├── authService.ts      # User authentication
│   │   ├── azanService.ts      # Prayer time calculations
│   │   └── AnalyticsService.ts # Statistics & tracking
│   ├── types/                  # TypeScript interfaces
│   ├── utils/                  # Helper functions
│   ├── validators/             # Joi validation schemas
│   └── index.ts                # Application entry point
├── public/                     # Frontend static files
│   ├── index.html              # Main dashboard
│   ├── login.html              # Authentication page
│   └── app.js                  # Client-side logic
├── time_data/                  # Prayer time JSON files
│   ├── index.json              # Master district index
│   └── *.json                  # Location-specific times
├── tests/                      # Unit & integration tests
├── dist/                       # Compiled JavaScript (build output)
└── package.json                # Project configuration
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only integration tests
npm run test:integration
```

---

## 🔧 Development

### Run in Development Mode
```bash
npm run dev
```

This uses `tsx` with watch mode for instant TypeScript recompilation.

### Build for Production
```bash
npm run build
npm start
```

---

## 📊 Analytics Dashboard

The admin dashboard provides comprehensive statistics:

- **Active Sessions** - Real-time session count and status
- **Total Groups** - Number of mapped WhatsApp groups
- **Messages Today** - Delivered and failed message counts
- **Delivery Rate** - Success percentage
- **Server Uptime** - Continuous operation time
- **Top Locations** - Most popular prayer time locations
- **Session Health** - Individual session status monitoring

---

## 🛡️ Security Best Practices

1. **Change default JWT secret** - Use a strong, random secret
2. **Secure MongoDB connection** - Use SSL/TLS for Atlas
3. **Whitelist IPs** - Restrict MongoDB access to your server
4. **Environment variables** - Never commit `.env` to Git
5. **Regular updates** - Keep dependencies up to date
6. **Strong passwords** - Enforce minimum 6 characters
7. **HTTPS in production** - Use reverse proxy (nginx/Apache)

---

## 🐛 Troubleshooting

### QR Code Doesn't Appear
- Check that session is in `qr-scan` status
- Refresh the page
- Delete and recreate the session

### Messages Not Sending
- Verify group mapping exists
- Check session is `connected`
- Review MongoDB connection status
- Check server logs for errors

### MongoDB Connection Timeout
- Verify MongoDB Atlas cluster is active
- Check IP whitelist includes your server
- Ensure credentials are correct
- Test connection string separately

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Developer

<div align="center">

### Created with ❤️ by **cipherNichu**

[![GitHub](https://img.shields.io/badge/GitHub-cipherNichu-181717?style=for-the-badge&logo=github)](https://github.com/cipherNichu)

*Building tools to serve the Muslim community* 🕌

</div>

---

## 🙏 Acknowledgments

- **Baileys** - WhatsApp Web API library
- **Kerala Prayer Times** - Accurate prayer time data
- **Muslim Community** - For inspiration and feedback
- **Open Source Contributors** - For amazing libraries and tools

---

## 📞 Support

For issues, questions, or suggestions:

- 🐛 **Report bugs** - [GitHub Issues](https://github.com/cipherNichu/whatsapp-azan-bot/issues)
- 💬 **Discussions** - [GitHub Discussions](https://github.com/cipherNichu/whatsapp-azan-bot/discussions)
- 📧 **Email** - cipher.nichu@example.com

---

<div align="center">

**May Allah accept this humble effort to serve the community** 🤲

*If you find this project useful, please consider giving it a ⭐ on GitHub!*

</div>
