// Admin-only metrics for CVPro Zambia
// Tracks users and sales from the Netlify Blobs store.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
}

async function getBlobStore() {
  // eslint-disable-next-line global-require
  const { getStore } = require('@netlify/blobs');
  return getStore('cvpro-zambia-cvs');
}

function getUser(context) {
  return context?.clientContext?.user || null;
}

function getEmailFromUser(user) {
  return (
    user?.email ||
    user?.user_metadata?.email ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    ''
  ).toString();
}

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAdmin(context) {
  const user = getUser(context);
  if (!user) return false;

  // 1) Allow list via env var (simple + reliable)
  const email = getEmailFromUser(user).toLowerCase();
  const allowEmails = parseCsvEnv(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase());
  if (email && allowEmails.includes(email)) return true;

  const sub = (user?.sub || '').toString();
  const allowSubs = parseCsvEnv(process.env.ADMIN_SUBS);
  if (sub && allowSubs.includes(sub)) return true;

  // 2) Fallback: role-based (if you add roles in Netlify Identity)
  const roles =
    user?.app_metadata?.roles ||
    user?.app_metadata?.authorization?.roles ||
    user?.user_metadata?.roles ||
    [];

  if (Array.isArray(roles) && roles.map(String).includes('admin')) return true;

  return false;
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

  const user = getUser(context);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  if (!isAdmin(context)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden' })
    };
  }

  const priceZmw = Number(process.env.CV_PRICE_ZMW || 50);
  const store = await getBlobStore();

  const savedUsers = new Set();
  const paidUsers = new Set();
  const salesKeys = [];

  // Iterate all keys in a single pass.
  // Keys in this store include:
  // - ${userId}:latest
  // - ${userId}:entitlement
  // - sales/<timestamp>_<userId>_<hash>.json (new)
  for await (const page of store.list({ paginate: true })) {
    for (const blob of page.blobs || []) {
      const key = blob?.key || '';
      if (!key) continue;

      if (key.endsWith(':latest')) {
        savedUsers.add(key.slice(0, -':latest'.length));
      } else if (key.endsWith(':entitlement')) {
        paidUsers.add(key.slice(0, -':entitlement'.length));
      } else if (key.startsWith('sales/')) {
        salesKeys.push(key);
      }
    }
  }

  salesKeys.sort();
  const recentKeys = salesKeys.slice(-25).reverse();

  const recentSales = [];
  for (const key of recentKeys) {
    try {
      const raw = await store.get(key);
      const rec = raw ? JSON.parse(raw) : null;
      if (rec && typeof rec === 'object') recentSales.push(rec);
    } catch {
      // ignore
    }
  }

  const salesCount = salesKeys.length;

  // Revenue: sum logged sale amounts (best-effort). To avoid timeouts,
  // cap how many sales records we fetch.
  const MAX_REVENUE_SALES = 1000;
  const revenueKeys = salesKeys.length > MAX_REVENUE_SALES ? salesKeys.slice(-MAX_REVENUE_SALES) : salesKeys;
  const revenueIsPartial = salesKeys.length > revenueKeys.length;

  let revenueZmw = 0;
  let revenueCount = 0;
  for (const key of revenueKeys) {
    try {
      const raw = await store.get(key);
      const rec = raw ? JSON.parse(raw) : null;
      const amt = Number(rec?.amount);
      if (Number.isFinite(amt)) {
        revenueZmw += amt;
        revenueCount += 1;
      }
    } catch {
      // ignore
    }
  }

  if (!Number.isFinite(revenueZmw) || revenueCount === 0) {
    revenueZmw = Number.isFinite(priceZmw) ? salesCount * priceZmw : salesCount * 50;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      ok: true,
      priceZmw: Number.isFinite(priceZmw) ? priceZmw : 50,
      usersWithSavedCv: savedUsers.size,
      paidUsers: paidUsers.size,
      salesCount,
      revenueZmw,
      revenueIsPartial,
      recentSales
    })
  };
};
