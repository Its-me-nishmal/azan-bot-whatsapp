# Personal Message Commands - User Guide

## 📱 How to Use

Send any of these commands via WhatsApp to the bot:

---

## 🕌 Available Commands

### 1. Get Today's Prayer Times
```
azan-today-kozhikode
```
or simply:
```
azan-kozhikode
```

**Response:**
```
🕌 Today's Prayer Times

📍 Location: Kozhikode North, Kozhikode
📅 Date: 01/02/2026

⏰ Prayer Times:
• Fajr (Dawn): 05:45
• Dhuhr (Noon): 12:35
• Asr (Afternoon): 16:05
• Maghrib (Sunset): 18:35
• Isha (Night): 19:45

May Allah accept your prayers. 🤲
```

---

### 2. Get Next Prayer Time
```
azan-next-kochi
```

**Response:**
```
🕌 Next Prayer Time

📍 Location: Kochi, Ernakulam
⏰ Current Time: 14:30

🔔 Next Prayer: Asr
⏱️ Time: 16:05

May Allah guide us. 🤲
```

---

### 3. View All Locations
```
locations
```

**Response:**
```
📍 Available Locations (14)

1. Kasaragod (Kasaragod)
2. Kannur (Kannur)
3. Kalpetta (Wayanad)
4. Kozhikode North (Kozhikode)
5. Malappuram (Malappuram)
6. Palakkad (Palakkad)
7. Thrissur (Thrissur)
8. Kochi (Ernakulam)
9. Idukki (Idukki)
10. Kottayam (Kottayam)
11. Alappuzha (Alappuzha)
12. Thiruvalla (Pathanamthitta)
13. Kollam (Kollam)
14. Thiruvananthapuram (Trivandrum)

Usage:
Send "azan-today-[location]" to get prayer times.
Example: azan-today-kasaragod

May Allah guide you! 🤲
```

---

### 4. Help
```
help
```

Shows all available commands and usage examples.

---

## ✨ Features

### Smart Location Matching
- **Case-insensitive**: `KOZHIKODE`, `kozhikode`, `Kozhikode` all work
- **Partial matching**: `malap` finds `Malappuram`
- **Works with district names**: `wayanad` finds `Kalpetta`

### Command Variations
All these work the same:
- `azan-today-kochi`
- `/azan-today-kochi`
- `azan-kochi` (defaults to today)

### Automatic Responses
- Bot only responds to **personal messages** (not groups)
- Instant replies with formatted prayer times
- Error messages if location not found

---

## 📝 Examples

### Example 1: Quick Prayer Time Check
**User sends:**
```
azan-thrissur
```

**Bot replies with today's full schedule for Thrissur**

---

### Example 2: Planning for Next Prayer
**User sends:**
```
azan-next-malappuram
```

**Bot replies with the upcoming prayer time and current time**

---

### Example 3: Finding Available Locations
**User sends:**
```
locations
```

**Bot replies with all 14 districts**

---

## 🔧 Technical Details

- All times are in **24-hour format** (HH:MM)
- Timezone: **Asia/Kolkata (IST)**
- Prayer data is perpetual (valid until 2060)
- Commands are processed instantly
- No rate limiting on personal messages

---

## ⚠️ Important Notes

1. **Personal messages only** - Commands sent in groups are ignored
2. **Bot must be connected** - Session must show "🟢 Connected" status
3. **Exact location names** - Use `locations` command to see valid names
4. **No spaces in commands** - Use `azan-kozhikode`, not `azan kozhikode`

---

## 🚀 Getting Started

1. **Scan QR code** on the web interface (http://localhost:3000)
2. **Save bot number** in your WhatsApp contacts
3. **Send a message**: `help`
4. **Bot replies** with command list
5. **Try it**: `azan-today-kochi`

---

## 📞 Support Commands

| Command | Description |
|---------|-------------|
| `help` | Show all commands |
| `locations` | List all 14 locations |
| `azan-today-[location]` | Today's prayer times |
| `azan-next-[location]` | Next prayer time |

May Allah accept your prayers! 🤲
