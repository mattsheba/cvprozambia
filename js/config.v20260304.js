// API Configuration - Production Mode with Netlify Functions
const STANDALONE_MODE = true; // Using Netlify Functions for secure API calls

// Lenco Configuration
const LENCO_PUBLIC_KEY = 'pub-cd353f758b26d57cead328816d6e7691b9f0dcea6f5a9f7b';

// Pricing (ZMW)
// PROMO: 2-week special (CV K35, Cover Letter K25, Bundle K55)
// To restore normal prices, set CV_PRICE_ZMW=70, COVER_LETTER_PRICE_ZMW=50, BUNDLE_PRICE_ZMW=100
const CV_PRICE_ZMW = 35; // Promo price
const COVER_LETTER_PRICE_ZMW = 25; // Promo price
const BUNDLE_PRICE_ZMW = 55; // Promo price (CV+Letter)

// Payments
const PAYMENTS_ENABLED = true;

// PDF formatting
// jsPDF built-in fonts: 'times' (closest to Times New Roman) and 'helvetica' (closest to Arial)
const PDF_FONT_FAMILY = 'times';

// NOTE: API keys are stored in Netlify Environment Variables
