# 🕌 Specialized Prayer Analytics & Bot Intelligence

This document outlines the high-priority "Smart Features" specifically requested for randomized engagement and deep spiritual analytics.

## 🌙 Randomized Isha Post-Prayer Analytics
To prevent spam bans and ensure organic engagement, the bot will implement a specialized "Check-in" mechanism for Isha prayer.

- **Mechanism**:
    - **Trigger**: 3-4 hours after Isha Azan time.
    - **Randomization**: The bot will NOT blast the group. Instead, it will send the check-in to members **one-by-one with random intervals** between them.
    - **Privacy-First**: Messages are sent as personal check-ins or targeted group mentions to maintain a "gentle reminder" feel.

- **Interaction (WhatsApp Poll)**:
    - A native WhatsApp Poll with **5 clickable options** representing the daily prayers:
        1. 🌅 Subh (Fajr)
        2. ☀️ Duhr
        3. 🕒 Asr
        4. 🌆 Magrib
        5. 🌙 Isha
    - Users can tick multiple options to indicate which prayers they completed during the day.

- **Persistence (MongoDB)**:
    - Every response is automatically logged in a `UserPrayerStats` collection.
    - Data is indexed by the **WhatsApp Mobile Number**.
    - Tracks streaks, consistency percentages, and preferred prayer locations.

## 🛠️ Administrative Bot Commands (`!analyze`)
A new command suite for admins and managers to track community engagement directly within WhatsApp.

- **`!analyze` Command**:
    - Generates an instant summary of group engagement for the day/week.
    - **Output**: Total responses, % of Jamat prayers, and a "Consistency Leaderboard" (optional).
    - **Filters**: `!analyze today`, `!analyze week`, or `!analyze @user`.
- **`!status` Command**:
    - Check the bot's health, current session status, and upcoming prayer times for the group.
- **`!location` Command**:
    - Quickly view or change the mapped location for the current group.

## 🛡️ Anti-Spam & Reliability
- **Throttling Queue**: A dedicated queue manager for the one-by-one messaging to stay within WhatsApp's rate limits.
- **Session Rotation**: If multiple sessions are connected, the bot can rotate which session sends the "Did you pray?" poll to balance the load.

---
*Refined for Targeted Community Engagement - 2026*
