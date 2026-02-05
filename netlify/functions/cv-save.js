// Save a user's CV snapshot (requires Netlify Identity)

let _memoryStore = globalThis.__cvMemoryStore;
if (!_memoryStore) {
  _memoryStore = new Map();
  globalThis.__cvMemoryStore = _memoryStore;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

async function getBlobStore() {
  try {
    // Optional dependency in local dev; required in production.
    // eslint-disable-next-line global-require
    const { getStore } = require('@netlify/blobs');
    return getStore('cvpro-zambia-cvs');
  } catch {
    return null;
  }
}

function getUserId(context) {
  return context?.clientContext?.user?.sub || null;
}

exports.handler = async (event, context) => {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const userId = getUserId(context);
  if (!userId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const snapshot = payload?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing snapshot' })
    };
  }

  const key = `${userId}:latest`;
  const record = {
    snapshot,
    updatedAt: new Date().toISOString()
  };

  const encoded = JSON.stringify(record);
  const maxBytes = 200 * 1024;
  if (Buffer.byteLength(encoded, 'utf8') > maxBytes) {
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify({ error: 'Snapshot too large' })
    };
  }

  const store = await getBlobStore();
  if (store) {
    await store.set(key, encoded);
  } else {
    _memoryStore.set(key, encoded);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ok: true, key, updatedAt: record.updatedAt })
  };
};
