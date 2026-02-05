// Netlify Serverless Function to securely proxy Gemini API calls
const _rateState = globalThis.__aiRateState || (globalThis.__aiRateState = new Map());

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  const isDev = process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev';

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Gemini API key from environment variables (set in Netlify dashboard)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  // Feature flag: allow disabling suggestions without code changes
  const aiEnabled = (process.env.AI_ENABLED ?? 'true').toLowerCase() === 'true';
  if (!aiEnabled) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Suggestions temporarily disabled' })
    };
  }

  // Debug helper: list available models for this API key.
  // Usage (local): GET /.netlify/functions/generate-ai?listModels=1
  if (isDev && event.httpMethod === 'GET' && event.queryStringParameters?.listModels === '1') {
    try {
      if (!GEMINI_API_KEY) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'GEMINI_API_KEY not set; cannot list Gemini models' })
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`
      );
      const data = await response.json();
      const models = Array.isArray(data?.models)
        ? data.models.map((m) => ({ name: m.name, supportedGenerationMethods: m.supportedGenerationMethods }))
        : [];

      return {
        statusCode: response.ok ? 200 : (response.status || 500),
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ models })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to list models', message: error.message })
      };
    }
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const { prompt, type, model, debug } = JSON.parse(event.body || '{}');

    const debugEnabled = isDev && (debug === true || debug === '1' || event.queryStringParameters?.debug === '1');

    // Basic burst throttle (best-effort; serverless instances are not guaranteed to persist)
    const ip =
      (event.headers?.['x-nf-client-connection-ip'] ||
        event.headers?.['x-forwarded-for'] ||
        event.headers?.['client-ip'] ||
        'unknown')
        .toString()
        .split(',')[0]
        .trim();

    const now = Date.now();
    const windowMs = Number.parseInt(process.env.AI_RATE_WINDOW_MS || '60000', 10);
    const maxRequestsPerWindow = Number.parseInt(process.env.AI_RATE_MAX_REQUESTS || '20', 10);
    const entry = _rateState.get(ip) || { start: now, count: 0 };
    if (now - entry.start > windowMs) {
      entry.start = now;
      entry.count = 0;
    }
    entry.count += 1;
    _rateState.set(ip, entry);
    if (entry.count > maxRequestsPerWindow) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Rate limit exceeded. Please wait and try again.' })
      };
    }

    if (!prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Hard limit prompt size to control cost/abuse
    const maxPromptChars = Number.parseInt(process.env.AI_MAX_PROMPT_CHARS || '4000', 10);
    if (typeof prompt !== 'string' || prompt.length > maxPromptChars) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Prompt too long. Max ${maxPromptChars} characters.` })
      };
    }

    // Output token caps by request type (keeps costs predictable)
    const maxOutputTokensByType = {
      // NOTE: Gemini 2.5 models may spend a large portion of the output budget on
      // internal "thoughts" tokens; keep these higher to avoid truncation.
      summary: 600,
      skills: 400,
      responsibilities: 900
    };
    const requestedType = (type || 'default').toString().toLowerCase();
    const defaultMaxOutputTokens = Number.parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '500', 10);
    const maxOutputTokens = maxOutputTokensByType[requestedType] ?? defaultMaxOutputTokens;

    // Gemini
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' })
      };
    }

    // Model selection
    // - per-request body { model } always wins
    // - allow optional per-type env override for skills
    // - then fallback to GEMINI_MODEL
    // - finally use sensible defaults per type
    const defaultModelByType = {
      summary: 'gemini-2.0-flash',
      skills: 'gemini-2.0-flash',
      responsibilities: 'gemini-2.0-flash'
    };

    const requestedModelRaw = (
      requestedType === 'skills'
        ? (
            model ||
            process.env.GEMINI_MODEL_SKILLS ||
            defaultModelByType.skills ||
            process.env.GEMINI_MODEL ||
            'gemini-2.5-flash'
          )
        : (model || process.env.GEMINI_MODEL || defaultModelByType[requestedType] || 'gemini-2.5-flash')
    ).trim();
    const requestedModelSafe = requestedModelRaw
      .replace(/[^a-zA-Z0-9._\/-]/g, '')
      .replace(/^\/*/, '');
    const modelId = requestedModelSafe.startsWith('models/')
      ? requestedModelSafe.slice('models/'.length)
      : requestedModelSafe;

    const url = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
    const commonPayload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    // Gemini 2.5 models can consume a large part of the output budget on internal
    // "thoughts" tokens. We try to disable/limit that, and fall back if unsupported.
    const payloadWithThinkingDisabled = {
      ...commonPayload,
      generationConfig: {
        maxOutputTokens,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const payloadWithoutThinkingConfig = {
      ...commonPayload,
      generationConfig: {
        maxOutputTokens,
        temperature: 0.7
      }
    };

    const doFetch = async (payload) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      return { response, data };
    };

    let { response, data } = await doFetch(payloadWithThinkingDisabled);
    if (!response.ok || data?.error) {
      const message = (data?.error?.message || '').toString();
      const looksLikeUnsupportedField =
        message.includes('Unknown name') && (message.includes('thinkingConfig') || message.includes('thinking'));

      if (looksLikeUnsupportedField) {
        ({ response, data } = await doFetch(payloadWithoutThinkingConfig));
      }
    }

    if (!response.ok || data?.error) {
      const statusCode = data?.error?.code || response.status || 500;
      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error?.message || 'Gemini API request failed',
          status: data?.error?.status,
          details: data
        })
      };
    }

    // Check if we got a valid response
    const parts = data?.candidates?.[0]?.content?.parts;
    const hasTextPart = Array.isArray(parts) && parts.some((p) => typeof p?.text === 'string' && p.text.length);
    if (hasTextPart) {
      const generatedText = parts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        body: JSON.stringify({
          text: generatedText,
          success: true,
          ...(debugEnabled
            ? {
                debug: {
                  modelId,
                  requestedType,
                  maxOutputTokens,
                  finishReason: data?.candidates?.[0]?.finishReason,
                  safetyRatings: data?.candidates?.[0]?.safetyRatings,
                  usageMetadata: data?.usageMetadata
                }
              }
            : {})
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to generate content',
          details: data 
        })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
