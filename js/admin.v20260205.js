function toast(message, type = 'info') {
  const bg = type === 'success'
    ? '#16a34a'
    : type === 'error'
      ? '#ef4444'
      : type === 'warn'
        ? '#f59e0b'
        : '#2563eb';

  try {
    Toastify({
      text: String(message || ''),
      duration: 3500,
      gravity: 'top',
      position: 'right',
      close: true,
      style: { background: bg }
    }).showToast();
  } catch {
    // noop
  }
}

function getIdentityWidget() {
  return window.netlifyIdentity || null;
}

function getCurrentUser() {
  const idw = getIdentityWidget();
  if (!idw?.currentUser) return null;
  try {
    return idw.currentUser();
  } catch {
    return null;
  }
}

async function fetchWithAuth(path, options = {}) {
  const user = getCurrentUser();
  if (!user?.jwt) throw new Error('Not logged in');
  const token = await user.jwt();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
}

function moneyZmw(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(0);
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSales(rows, priceZmw) {
  const body = document.getElementById('salesRows');
  if (!body) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="admin-muted">No sales logged yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r) => {
    const dt = esc(r.paidAt || r.createdAt || '');
    const user = esc(r.email || r.userId || '');
    const amt = esc(`${r.currency || 'ZMW'} ${moneyZmw(r.amount ?? priceZmw)}`);
    const ref = esc(r.reference || '—');
    const st = esc(r.status || 'paid');
    return `<tr>
      <td>${dt}</td>
      <td>${user}</td>
      <td>${amt}</td>
      <td>${ref}</td>
      <td>${st}</td>
    </tr>`;
  }).join('');
}

async function refreshAdmin() {
  const refreshBtn = document.getElementById('adminRefreshBtn');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const data = await fetchWithAuth('/.netlify/functions/admin-metrics', { method: 'GET' });

    setText('mSavedUsers', String(data?.usersWithSavedCv ?? '—'));
    setText('mPaidUsers', String(data?.paidUsers ?? '—'));
    setText('mSales', String(data?.salesCount ?? '—'));
    setText('mRevenue', String(data?.revenueZmw ?? '—'));
    setText('mPrice', `ZMW ${moneyZmw(data?.priceZmw ?? 50)}`);

    renderSales(data?.recentSales || [], data?.priceZmw ?? 50);
    toast('Admin data refreshed.', 'success');
  } catch (e) {
    const status = e?.status;
    if (status === 401) {
      toast('Please login to view admin dashboard.', 'warn');
    } else if (status === 403) {
      toast('Access denied (not admin).', 'error');
    } else {
      toast(e?.message || 'Failed to load admin data.', 'error');
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function setUiForUser(user) {
  const statusEl = document.getElementById('adminStatus');
  const loginBtn = document.getElementById('adminLoginBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const refreshBtn = document.getElementById('adminRefreshBtn');

  const isLoggedIn = Boolean(user);
  const email = user?.email || user?.user_metadata?.email || user?.user_metadata?.full_name;

  if (statusEl) {
    statusEl.textContent = isLoggedIn
      ? `Signed in${email ? ` as ${email}` : ''}`
      : 'Not signed in';
  }
  if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? '' : 'none';
  if (refreshBtn) refreshBtn.disabled = !isLoggedIn;
}

document.addEventListener('DOMContentLoaded', () => {
  const idw = getIdentityWidget();
  if (idw?.init) {
    try { idw.init(); } catch {}

    try {
      idw.on('init', (user) => setUiForUser(user));
      idw.on('login', (user) => {
        setUiForUser(user);
        toast('Logged in.', 'success');
        refreshAdmin().catch(() => {});
      });
      idw.on('logout', () => {
        setUiForUser(null);
        toast('Logged out.', 'info');
      });
    } catch {}
  }

  setUiForUser(getCurrentUser());

  const loginBtn = document.getElementById('adminLoginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (!idw?.open) {
        toast('Login not available (Netlify Identity not enabled).', 'error');
        return;
      }
      idw.open('login');
    });
  }

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (!idw?.logout) return;
      idw.logout();
    });
  }

  const refreshBtn = document.getElementById('adminRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => refreshAdmin());
  }

  if (getCurrentUser()) {
    refreshAdmin().catch(() => {});
  }
});
