// API Configuration - Production Mode with Netlify Functions
const STANDALONE_MODE = true; // Using Netlify Functions for secure API calls

// Lenco Configuration
const LENCO_PUBLIC_KEY = 'pub-cd353f758b26d57cead328816d6e7691b9f0dcea6f5a9f7b';

// Pricing (ZMW)
// NOTE: These are client-visible prices used to set the Lenco inline amount.
// Server-side functions only store best-effort entitlements/sales logs.
const CV_PRICE_ZMW = 50;
const COVER_LETTER_PRICE_ZMW = 30;
const BUNDLE_PRICE_ZMW = 70;

// NOTE: API keys are now stored securely in Netlify Environment Variables
// No need to add GEMINI_API_KEY here - it's handled by serverless functions
// Smart suggestions work automatically when deployed to Netlify

// Backend URL (only used if STANDALONE_MODE = false)
const API_BASE_URL = 'http://localhost:5000';
