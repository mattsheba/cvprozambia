// Mark the current CV version as paid for this user (requires Netlify Identity)
// NOTE: This is a best-effort entitlement marker. For stronger enforcement,
// verify payment server-side using a payment provider webhook/API.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

  const snapshotHash = (payload?.snapshotHash || '').toString().trim();
  if (!snapshotHash || snapshotHash.length < 16 || snapshotHash.length > 128) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid snapshotHash' })
    };
  }

  const payment = payload?.payment && typeof payload.payment === 'object' ? payload.payment : {};
  const amount = Number(payment?.amount);
  const currency = (payment?.currency || 'ZMW').toString().trim() || 'ZMW';
  const reference = (payment?.reference || '').toString().trim();
  const status = (payment?.status || 'paid').toString().trim() || 'paid';

  const record = {
    paidHash: snapshotHash,
    paidAt: new Date().toISOString()
  };

  const store = await getBlobStore();
  const key = `${userId}:entitlement`;
  await store.set(key, JSON.stringify(record));

  // Best-effort sales logging (for admin dashboard). This is not a payment verification.
  const tsSafe = record.paidAt.replace(/[:.]/g, '-');
  const saleKey = `sales/${tsSafe}_${userId}_${snapshotHash.slice(0, 10)}.json`;
  const saleRecord = {
    paidAt: record.paidAt,
    userId,
    email: context?.clientContext?.user?.email || context?.clientContext?.user?.user_metadata?.email || null,
    amount: Number.isFinite(amount) ? amount : 50,
    currency,
    reference: reference || null,
    status,
    snapshotHash
  };
  await store.set(saleKey, JSON.stringify(saleRecord));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ok: true, ...record })
  };
};
