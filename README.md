# CVPro Zambia - Standalone HTML Version

**Static CV builder with secure serverless suggestions (Netlify Functions).**

## Features

- 📄 Client-side PDF generation (jsPDF)
- ✨ Optional smart suggestions (secure serverless)
- 💰 Lenco payment integration (Mobile Money)
- 📱 Fully responsive design
- 🎨 Modern gradient UI
- 💬 WhatsApp support button
- 🚀 Works as a static site; suggestions require Netlify deploy (or local Netlify dev)

## How It Works

1. **PDF Generation**: Uses jsPDF library to create PDFs directly in the browser
2. **Smart Suggestions**: Uses a Netlify Function proxy so the API key stays on the server
3. **Payment**: Lenco widget handles payment, PDF generates immediately after

## Running

**Option 1: Double-click index.html** (works directly in browser)

**Option 2: Local server**
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000

## Configuration

Edit `js/config.js` to set your Lenco public key.

## Deployment

Upload to any static hosting:
- **Netlify**: Drag & drop folder
- **Vercel**: Push to git
- **GitHub Pages**: Enable in repo settings
- **Any web host**: Upload via FTP

## Security Note

API keys should never be placed in client-side JavaScript. This project is set up to keep keys in Netlify environment variables via a serverless function.
