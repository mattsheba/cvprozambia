// Get a user's download entitlement for their last paid CV version (requires Netlify Identity)

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('cvpro-zambia-cvs');
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

  const store = await getBlobStore();
  const key = `${userId}:entitlement`;

  const raw = await store.get(key);
  if (!raw) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ok: true, paidHash: null, paidCvHash: null, paidCoverHash: null, paidAt: null })
    };
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    record = {};
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      ok: true,
      paidHash: record.paidHash || null,
      paidCvHash: record.paidCvHash || record.paidHash || null,
      paidCoverHash: record.paidCoverHash || null,
      paidAt: record.paidAt || null
    })
  };
};
