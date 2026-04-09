# Netlify Functions Setup - Deployment Guide

## ✅ Setup Complete!

Your CV Generator is now configured to use **Netlify Functions** for secure suggestion generation (API calls).

## 📁 Files Created

1. **netlify/functions/generate-ai.js** - Serverless function to proxy the Gemini API
2. **netlify.toml** - Netlify configuration
3. **.env.example** - Environment variable template
4. **.gitignore** - Prevents committing secrets

## 🔐 Login + Saved CVs (Netlify Identity)

This project supports user login so a user's CV can be saved/loaded later, and so returning users can re-download for free when their CV is unchanged.

### Enable Netlify Identity
1. In Netlify Dashboard → your site
2. Go to **Integrations** (or **Identity** depending on UI)
3. Enable **Netlify Identity**
4. Under Identity settings:
    - Enable **Email** provider
    - Set registration to **Invite only** or **Open** (your choice)

### What it does
- Download can be one-off without login.
- Login enables saved CV history (save/load) and free re-downloads when unchanged.
- On successful download, the CV snapshot is saved server-side via:
   - `/.netlify/functions/cv-save`
   - `/.netlify/functions/cv-load`

### Pricing logic (free re-download)
- First time (or after edits): user pays ZMW 50 to download.
- Re-download is free if the CV content is unchanged since the last successful payment.
- If the user edits the CV (content changes), payment is required again to download the updated version.

## 🧑‍💼 Admin Dashboard (/admin)

A simple admin dashboard is available at:
- `https://<your-domain>/admin`

It shows best-effort metrics from the same Netlify Blobs store:
- Users with saved CVs
- Paid users
- Logged sales + recent sales list

### Admin access control
The admin API is protected by Netlify Identity + an allow-list env var.

1) Enable Netlify Identity (as above)
2) Create your admin user (sign up / invite)
3) In Netlify Dashboard → Site settings → Environment variables, add:
- `ADMIN_EMAILS` = `you@example.com,another@example.com`

Optional:
- `ADMIN_SUBS` = comma-separated Identity user IDs (advanced)
- `CV_PRICE_ZMW` = set the price used for revenue estimate (default: 50)

### Notes
- Sales are logged when `/.netlify/functions/cv-mark-paid` is called after a successful payment.
- This is not server-side payment verification.

### Notes
- Saved CVs are per-user account.
- In local dev, the save/load functions fall back to an in-memory store unless Netlify credentials are available.

## 🚀 Deployment Steps

### 1. Get Your Gemini API Key
- Visit: https://makersuite.google.com/app/apikey
- Create a new API key
- Copy it for the next step

### 2. Push to GitHub
```bash
git add .
git commit -m "Add Netlify Functions for secure suggestions"
git push
```

### 3. Configure Netlify

#### If this is a new site:
1. Go to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository
4. Build settings will auto-detect (leave as default)
5. Click "Deploy site"

#### Add Environment Variable:
1. Go to your site in Netlify Dashboard
2. Navigate to: **Site settings** → **Environment variables**
3. Click **Add a variable**
4. Add:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `your_actual_gemini_api_key`
5. Click **Save**

### 4. Redeploy (if needed)
- Go to **Deploys** tab
- Click **Trigger deploy** → **Clear cache and deploy site**

## ✨ That's It!

Your suggestion features will now work securely without exposing API keys in the frontend.

## 🧪 Testing Locally (Optional)

To test Netlify Functions locally:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Create a .env file (don't commit this!)
echo "GEMINI_API_KEY=your_key_here" > .env

# Run locally
netlify dev
```

This will start a local server at `http://localhost:8888` with functions enabled.

## 🔒 Security

✅ API key is stored securely in Netlify environment variables
✅ Never committed to GitHub
✅ Only accessible server-side
✅ Protected from client-side exposure

## 📊 Free Tier Limits

- **Netlify Functions**: 125,000 requests/month
- **Gemini API**: Check current limits at https://ai.google.dev/pricing

---

**Questions?** Check Netlify Functions docs: https://docs.netlify.com/functions/overview/
