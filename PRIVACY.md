# 🛡️ Privacy Policy

**Last updated:** July 2026

Sonic Player respects your privacy. This document explains what data the application collects, why, and how it is handled.

---

## 1. What Data We Collect

### 🌐 Geo-Location (Country Detection)

- Sonic Player uses **[ip-api.com](http://ip-api.com/)** to determine your country based on your IP address.
- **What is sent:** A simple HTTP request to `ip-api.com/json` with your public IP.
- **Why:** To respect regional content restrictions (e.g., licensing) and to tailor default settings.
- **What is stored:** Nothing. The IP-based lookup result is used **in-memory only** and is **never saved** to disk or sent anywhere else.

### 🔍 Lyrics Search

- When you use the **search** feature to look up lyrics, the app sends the track title and artist name to the **LRCLib API** (`lrclib.net`).
- **What is sent:** Track title + artist name.
- **Why:** To fetch synchronized (LRC) lyrics for the currently playing song.
- **What is stored:** Nothing. The result is cached temporarily in memory for performance — **never saved to disk** or shared.

### 📊 No Analytics or Tracking

- Sonic Player **does not** embed analytics scripts, tracking pixels, or telemetry.
- No user behavior is monitored, collected, or transmitted to any third party beyond the two services above.

### 📦 No Account System

- Sonic Player has **no user accounts**, no login, and no cloud storage.
- All data (playlists, favorites, settings) is stored **locally in your browser** (IndexedDB / localStorage) and never leaves your device.

---

## 2. Third-Party Services

| Service | Purpose | Data Sent | Privacy Policy |
|---------|---------|-----------|----------------|
| [ip-api.com](http://ip-api.com) | Country detection | Your public IP | [ip-api.com/docs/legal](https://ip-api.com/docs/legal) |
| [LRCLib](https://lrclib.net) | Fetch synced lyrics | Song title + artist | [lrclib.net](https://lrclib.net) |
| [YouTube](https://youtube.com) / [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Audio streaming & search | Search queries, video IDs | [YouTube Terms of Service](https://policies.google.com/privacy) |

> **Note about yt-dlp:** yt-dlp is an open-source command-line tool used to retrieve publicly available audio streams from YouTube. Requests are made client-side; no data is sent to us.

---

## 3. Data Storage

- **No serverside database** is used.
- No personal information is stored, collected, or processed by us.
- Downloads saved to the `backend/downloads/` directory stay on your device until you delete them.

---

## 4. Your Rights

Since we collect **no personal data**, there is nothing to access, correct, or delete on our end. For third-party services, please refer to their respective privacy policies above.

---

## 5. Changes to This Policy

If this policy changes in the future, the updated date at the top will reflect the change. Continued use of Sonic Player after changes constitutes acceptance of the new policy.

---

## 6. Contact

For privacy-related questions, open an issue on [GitHub](https://github.com/NEXROA-STUDI0/Sonic-player/issues) or reach out to us on [Email](mailto:nexorateam1@protonmail.com).

---

<div align="center">
  <sub>© 2026 NEXORA. All rights reserved.</sub>
</div>
