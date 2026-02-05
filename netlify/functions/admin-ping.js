// Admin-only auth check (requires Netlify Identity)
// Returns 200 only for allowed admin users.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
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

  const email = getEmailFromUser(user).toLowerCase();
  const allowEmails = parseCsvEnv(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase());
  if (email && allowEmails.includes(email)) return true;

  const sub = (user?.sub || '').toString();
  const allowSubs = parseCsvEnv(process.env.ADMIN_SUBS);
  if (sub && allowSubs.includes(sub)) return true;

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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ok: true })
  };
};
