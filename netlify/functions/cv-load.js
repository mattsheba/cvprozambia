// Load a user's last saved CV snapshot (requires Netlify Identity)

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

  if (event.httpMethod !== 'GET') {
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

  const key = `${userId}:latest`;

  const store = await getBlobStore();
  const raw = store ? await store.get(key) : _memoryStore.get(key);

  if (!raw) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'No saved CV found' })
    };
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Saved CV data is corrupted' })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ok: true, ...record })
  };
};
