/**
 * CVPro Zambia — Premium Enhancements  v20260320
 * Most features are now baked into index.html directly.
 * This file handles only the dynamic, data-driven pieces.
 */
(function () {
  'use strict';

  /* ── Admin button visibility (unchanged logic) ── */
  var adminCache = { isAdmin: false, checkedAt: 0 };

  function getCurrentUser() {
    var idw = window.netlifyIdentity;
    if (!idw || !idw.currentUser) return null;
    try { return idw.currentUser(); } catch (e) { return null; }
  }

  function refreshAdminButtonVisibility() {
    var adminBtn = document.getElementById('adminBtn');
    if (!adminBtn) return;
    var user = getCurrentUser();
    if (!user) { adminBtn.style.display = 'none'; adminCache = { isAdmin: false, checkedAt: 0 }; return; }
    var now = Date.now();
    if (adminCache.checkedAt && now - adminCache.checkedAt < 30000) {
      adminBtn.style.display = adminCache.isAdmin ? '' : 'none';
      return;
    }
    user.jwt().then(function (token) {
      return fetch('/.netlify/functions/admin-ping', {
        headers: { Authorization: 'Bearer ' + token }
      });
    }).then(function (res) {
      adminCache = { isAdmin: res.ok, checkedAt: Date.now() };
      adminBtn.style.display = adminCache.isAdmin ? '' : 'none';
    }).catch(function () {
      adminCache = { isAdmin: false, checkedAt: Date.now() };
      adminBtn.style.display = 'none';
    });
  }

  /* ── Account UI wiring ── */
  function setAccountUi(user) {
    var loginBtn  = document.getElementById('loginBtn');
    var signupBtn = document.getElementById('signupBtn');
    var logoutBtn = document.getElementById('logoutBtn');
    var loadBtn   = document.getElementById('loadCvBtn');
    var saveBtn   = document.getElementById('saveCvBtn');
    var statusEl  = document.getElementById('accountStatus');
    var hintEl    = document.getElementById('downloadLoginHint');
    var isIn      = Boolean(user);
    var email     = user && (user.email || (user.user_metadata && (user.user_metadata.email || user.user_metadata.full_name)));

    if (statusEl) {
      statusEl.textContent = isIn
        ? ('Signed in' + (email ? ' as ' + email : '') + '. Your CV can be saved for later.')
        : 'No account needed for a one-off download. Sign up to save and re-download later.';
    }
    if (loginBtn)  loginBtn.style.display  = isIn ? 'none' : '';
    if (signupBtn) signupBtn.style.display = isIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = isIn ? '' : 'none';
    if (loadBtn)   loadBtn.style.display   = isIn ? '' : 'none';
    if (saveBtn)   saveBtn.style.display   = isIn ? '' : 'none';
    if (hintEl)    hintEl.style.display    = isIn ? 'none' : '';
    refreshAdminButtonVisibility();
  }

  /* ── Netlify Identity wiring ── */
  function initIdentity() {
    var idw = window.netlifyIdentity;
    if (!idw) return;
    if (idw.init) {
      try { idw.init(); } catch (e) {}
      try {
        idw.on('init',   function (u) { setAccountUi(u); });
        idw.on('login',  function (u) { setAccountUi(u); if (typeof scheduleEntitlementUiRefresh === 'function') scheduleEntitlementUiRefresh(); });
        idw.on('logout', function ()  { setAccountUi(null); });
      } catch (e) {}
    }
    setAccountUi(getCurrentUser());
  }

  /* ── Init ── */
  function init() {
    initIdentity();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
