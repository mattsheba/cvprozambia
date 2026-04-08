// Netlify Serverless Function to securely proxy Claude (Anthropic) API calls
// Uses native fetch (Node 18+ on Netlify). No external dependencies required.
const _rateState = globalThis.__aiRateState || (globalThis.__aiRateState = new Map());

const jsonHeaders = (corsHeaders) => ({ 'Content-Type': 'application/json', ...corsHeaders });

const jsonResponse = (statusCode, body, corsHeaders) => ({
  statusCode,
  headers: jsonHeaders(corsHeaders),
  body: JSON.stringify(body)
});

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

  // Anthropic API key from environment variables (set in Netlify dashboard)
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Feature flag: allow disabling suggestions without code changes
  const aiEnabled = (process.env.AI_ENABLED ?? 'true').toLowerCase() === 'true';
  if (!aiEnabled) {
    return jsonResponse(503, { error: 'Suggestions temporarily disabled' }, corsHeaders);
  }

  // Debug helper: list available Claude models for this API key.
  // Usage (local): GET /.netlify/functions/generate-ai?listModels=1
  if (isDev && event.httpMethod === 'GET' && event.queryStringParameters?.listModels === '1') {
    try {
      if (!ANTHROPIC_API_KEY) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set; cannot list Claude models' })
        };
      }

      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      });
      const data = await response.json();
      const models = Array.isArray(data?.data)
        ? data.data.map((m) => ({ id: m.id, display_name: m.display_name }))
        : [];

      return jsonResponse(response.ok ? 200 : (response.status || 500), { models }, corsHeaders);
    } catch (error) {
      return jsonResponse(500, { error: 'Failed to list models', message: error.message }, corsHeaders);
    }
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, corsHeaders);
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

    // Prune stale entries to prevent unbounded Map growth across warm invocations.
    if (_rateState.size > 500) {
      const cutoff = now - windowMs * 2;
      for (const [k, v] of _rateState) {
        if (v.start < cutoff) _rateState.delete(k);
      }
    }

    if (entry.count > maxRequestsPerWindow) {
      return jsonResponse(429, { error: 'Rate limit exceeded. Please wait and try again.' }, corsHeaders);
    }

    if (!prompt) {
      return jsonResponse(400, { error: 'Prompt is required' }, corsHeaders);
    }

    // Hard limit prompt size to control cost/abuse
    const maxPromptChars = Number.parseInt(process.env.AI_MAX_PROMPT_CHARS || '4000', 10);
    if (typeof prompt !== 'string' || prompt.length > maxPromptChars) {
      return jsonResponse(413, { error: `Prompt too long. Max ${maxPromptChars} characters.` }, corsHeaders);
    }

    // Output token caps by request type (keeps costs predictable)
    const maxOutputTokensByType = {
      summary: 600,
      skills: 400,
      responsibilities: 900
    };
    const requestedType = (type || 'default').toString().toLowerCase();
    const defaultMaxOutputTokens = Number.parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '500', 10);
    const maxOutputTokens = maxOutputTokensByType[requestedType] ?? defaultMaxOutputTokens;

    // Claude
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse(500, { error: 'ANTHROPIC_API_KEY not configured. Set it in Netlify environment variables.' }, corsHeaders);
    }

    // Model selection: per-request body { model } wins, then env CLAUDE_MODEL, then defaults
    const defaultModelByType = {
      summary: 'claude-3-5-sonnet-20241022',
      skills: 'claude-3-5-sonnet-20241022',
      responsibilities: 'claude-3-5-sonnet-20241022'
    };

    const requestedModelRaw = (
      requestedType === 'skills'
        ? (
            model ||
            process.env.CLAUDE_MODEL_SKILLS ||
            defaultModelByType.skills ||
            process.env.CLAUDE_MODEL ||
            'claude-3-5-sonnet-20241022'
          )
        : (model || process.env.CLAUDE_MODEL || defaultModelByType[requestedType] || 'claude-3-5-sonnet-20241022')
    ).trim();
    const modelId = requestedModelRaw.replace(/[^a-zA-Z0-9._\/-]/g, '');

    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: modelId,
      max_tokens: maxOutputTokens,
      messages: [{ role: 'user', content: prompt }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    // Parse response safely — Anthropic may return non-JSON on some errors
    let data;
    try {
      data = await response.json();
    } catch (_) {
      const rawText = await response.text().catch(() => '');
      return jsonResponse(502, { error: `Anthropic returned non-JSON response (HTTP ${response.status})`, raw: rawText.slice(0, 300) }, corsHeaders);
    }

    if (!response.ok || data?.type === 'error') {
      // Map Anthropic 4xx codes that the frontend misreads as "function not found" → 502
      const anthropicStatus = response.status || 500;
      const statusCode = [404, 405, 501].includes(anthropicStatus) ? 502 : anthropicStatus;
      const errorMsg = data?.error?.message || `Anthropic error (HTTP ${anthropicStatus})`;
      console.error(`Anthropic error [${anthropicStatus}]: ${errorMsg}`, JSON.stringify(data));
      return jsonResponse(statusCode, { error: errorMsg, anthropicType: data?.error?.type, details: data }, corsHeaders);
    }

    // Parse Claude response
    const generatedText = Array.isArray(data?.content)
      ? data.content
          .filter((b) => b?.type === 'text' && typeof b?.text === 'string')
          .map((b) => b.text)
          .join('')
          .trim()
      : '';

    if (generatedText.length > 0) {
      return jsonResponse(200, {
        text: generatedText,
        success: true,
        ...(debugEnabled ? { debug: { modelId, requestedType, maxOutputTokens, stopReason: data?.stop_reason, usage: data?.usage } } : {})
      }, corsHeaders);
    } else {
      return jsonResponse(500, { error: 'Failed to generate content', details: data }, corsHeaders);
    }

  } catch (error) {
    console.error('generate-ai unhandled error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message }, corsHeaders);
  }
};
