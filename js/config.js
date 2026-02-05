// API Configuration - Production Mode with Netlify Functions
const STANDALONE_MODE = true; // Using Netlify Functions for secure API calls

// Lenco Configuration
const LENCO_PUBLIC_KEY = 'pub-cd353f758b26d57cead328816d6e7691b9f0dcea6f5a9f7b';

// NOTE: API keys are now stored securely in Netlify Environment Variables
// No need to add GEMINI_API_KEY here - it's handled by serverless functions
// Smart suggestions work automatically when deployed to Netlify

// Backend URL (only used if STANDALONE_MODE = false)
const API_BASE_URL = 'http://localhost:5000';
