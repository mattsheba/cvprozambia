// CV Data State
const cvData = {
    personalInfo: {},
    skills: [],
    skillSuggestions: [],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    hobbies: [],
    references: [],
    coverLetter: {
        role: '',
        company: '',
        jobDescription: '',
        text: '',
        includeInPdf: false
    }
};

let summarySuggestionDraft = '';
let coverLetterSuggestionDraft = '';

function bumpPreviewSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.classList.remove('preview-bump');
    void el.offsetWidth;
    el.classList.add('preview-bump');
    window.setTimeout(() => el.classList.remove('preview-bump'), 650);
}

function showSummarySuggestion(text) {
    summarySuggestionDraft = String(text || '').trim();
    const wrap = document.getElementById('summarySuggestionWrap');
    const out = document.getElementById('summarySuggestionText');
    if (!wrap || !out) return;
    if (!summarySuggestionDraft) {
        wrap.style.display = 'none';
        out.textContent = '';
        return;
    }
    out.textContent = summarySuggestionDraft;
    wrap.style.display = 'block';
}

function addGeneratedSummary() {
    if (!summarySuggestionDraft) return;
    const summaryEl = document.getElementById('summary');
    if (summaryEl) summaryEl.value = summarySuggestionDraft;
    showSummarySuggestion('');
    updatePreview();
    requestAnimationFrame(() => bumpPreviewSection('cvSummarySection'));
}

function discardGeneratedSummary() {
    showSummarySuggestion('');
}

function showCoverLetterSuggestion(text) {
    coverLetterSuggestionDraft = String(text || '').trim();
    const wrap = document.getElementById('coverSuggestionWrap');
    const out = document.getElementById('coverSuggestionText');
    if (!wrap || !out) return;
    if (!coverLetterSuggestionDraft) {
        wrap.style.display = 'none';
        out.textContent = '';
        return;
    }
    out.textContent = coverLetterSuggestionDraft;
    wrap.style.display = 'block';
}

function addGeneratedCoverLetter() {
    if (!coverLetterSuggestionDraft) return;
    const el = document.getElementById('coverLetterText');
    if (el) el.value = coverLetterSuggestionDraft;
    showCoverLetterSuggestion('');
    schedulePreviewUpdate();
}

function discardGeneratedCoverLetter() {
    showCoverLetterSuggestion('');
}

function renderSkillSuggestions() {
    const wrap = document.getElementById('skillsSuggestionsWrap');
    const container = document.getElementById('skillsSuggestions');
    if (!wrap || !container) return;

    const suggestions = Array.isArray(cvData.skillSuggestions) ? cvData.skillSuggestions : [];
    if (!suggestions.length) {
        wrap.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    wrap.style.display = 'block';
    container.innerHTML = suggestions.map((skill) => {
        const safe = String(skill || '');
        const escapedForAttr = safe.replace(/'/g, "\\'");
        return `
            <span class="tag tag-suggestion">
                ${escapeHtml(safe)}
                <button type="button" class="tag-add" title="Add" onclick="addSuggestedSkill('${escapedForAttr}')">+</button>
            </span>
        `;
    }).join('');
}

function addSuggestedSkill(skill) {
    const next = String(skill || '').trim();
    if (!next) return;
    const exists = cvData.skills.some((s) => String(s).toLowerCase() === next.toLowerCase());
    if (!exists) cvData.skills.push(next);
    cvData.skillSuggestions = (cvData.skillSuggestions || []).filter((s) => String(s).toLowerCase() !== next.toLowerCase());
    renderSkills();
    renderSkillSuggestions();
    requestAnimationFrame(() => bumpPreviewSection('cvSkillsSection'));
}

function addAllSuggestedSkills() {
    const suggestions = Array.isArray(cvData.skillSuggestions) ? cvData.skillSuggestions : [];
    if (!suggestions.length) return;

    for (const s of suggestions) {
        const skill = String(s || '').trim();
        if (!skill) continue;
        const exists = cvData.skills.some((x) => String(x).toLowerCase() === skill.toLowerCase());
        if (!exists) cvData.skills.push(skill);
    }

    cvData.skillSuggestions = [];
    renderSkills();
    renderSkillSuggestions();
    requestAnimationFrame(() => bumpPreviewSection('cvSkillsSection'));
}

function clearSkillSuggestions() {
    cvData.skillSuggestions = [];
    renderSkillSuggestions();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let previewUpdateRaf = 0;
function schedulePreviewUpdate() {
    if (previewUpdateRaf) cancelAnimationFrame(previewUpdateRaf);
    previewUpdateRaf = requestAnimationFrame(() => {
        previewUpdateRaf = 0;
        updatePreview();
        scheduleEntitlementUiRefresh();
    });
}

const loadedScripts = new Map();
function loadScriptOnce(src, { timeoutMs = 12000 } = {}) {
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const promise = new Promise((resolve, reject) => {
        const existing = Array.from(document.scripts || []).find((s) => s && s.src === src);
        if (existing) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        const timeout = window.setTimeout(() => {
            reject(new Error(`Timeout loading ${src}`));
        }, timeoutMs);

        script.onload = () => {
            window.clearTimeout(timeout);
            resolve();
        };
        script.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error(`Failed loading ${src}`));
        };

        document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
}

async function ensureJsPdfLoaded() {
    if (window.jspdf?.jsPDF) return;
    await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!window.jspdf?.jsPDF) throw new Error('jsPDF failed to initialize');
}

async function ensureLencoLoaded() {
    if (window.LencoPay?.getPaid) return;
    await loadScriptOnce('https://pay.lenco.co/js/v1/inline.js');
    if (!window.LencoPay?.getPaid) throw new Error('LencoPay failed to initialize');
}

// --- Account (Netlify Identity) + Saved CV ---
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

function setAccountUi({ user } = {}) {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loadCvBtn = document.getElementById('loadCvBtn');
    const saveCvBtn = document.getElementById('saveCvBtn');
    const statusEl = document.getElementById('accountStatus');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadHint = document.getElementById('downloadLoginHint');

    const isLoggedIn = Boolean(user);
    const email = user?.email || user?.user_metadata?.email || user?.user_metadata?.full_name;

    if (statusEl) {
        statusEl.textContent = isLoggedIn
            ? `Signed in${email ? ` as ${email}` : ''}. Your CV can be saved for later.`
            : 'No account needed for a one-off download. Sign up after to save and re-download later.';
    }

    if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : '';
    if (signupBtn) signupBtn.style.display = isLoggedIn ? 'none' : '';
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? '' : 'none';
    if (loadCvBtn) loadCvBtn.style.display = isLoggedIn ? '' : 'none';
    if (saveCvBtn) saveCvBtn.style.display = isLoggedIn ? '' : 'none';

    // Download is allowed without login (one-off). Login is required only for save/load
    // and for free re-downloads based on your saved entitlement.
    if (downloadBtn) downloadBtn.disabled = false;
    if (downloadHint) downloadHint.style.display = isLoggedIn ? 'none' : '';

    // Admin button only shows for admin users.
    refreshAdminButtonVisibility().catch(() => {});
}

function openLogin() {
    const idw = getIdentityWidget();
    if (!idw?.open) {
        showToast('Login is not available (Netlify Identity not enabled yet).', 'error');
        return;
    }
    idw.open('login');
}

function openSignup() {
    const idw = getIdentityWidget();
    if (!idw?.open) {
        showToast('Signup is not available (Netlify Identity not enabled yet).', 'error');
        return;
    }
    idw.open('signup');
}

function logout() {
    const idw = getIdentityWidget();
    if (!idw?.logout) return;
    idw.logout();
}

async function requireLogin() {
    const existing = getCurrentUser();
    if (existing) return existing;

    const idw = getIdentityWidget();
    if (!idw?.open || !idw?.on) {
        showToast('Login is not available (Netlify Identity not enabled yet).', 'error');
        return null;
    }

    return new Promise((resolve) => {
        const onLogin = (user) => {
            try { idw.off('login', onLogin); } catch {}
            resolve(user);
        };
        idw.on('login', onLogin);
        idw.open('login');
    });
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
        throw new Error(msg);
    }
    return data;
}

let adminAccessCache = { isAdmin: false, checkedAt: 0 };
async function refreshAdminButtonVisibility() {
    const adminBtn = document.getElementById('adminBtn');
    if (!adminBtn) return;

    const user = getCurrentUser();
    if (!user) {
        adminBtn.style.display = 'none';
        adminAccessCache = { isAdmin: false, checkedAt: 0 };
        return;
    }

    const now = Date.now();
    if (adminAccessCache.checkedAt && now - adminAccessCache.checkedAt < 30_000) {
        adminBtn.style.display = adminAccessCache.isAdmin ? '' : 'none';
        return;
    }

    try {
        await fetchWithAuth('/.netlify/functions/admin-ping', { method: 'GET' });
        adminAccessCache = { isAdmin: true, checkedAt: now };
        adminBtn.style.display = '';
    } catch {
        adminAccessCache = { isAdmin: false, checkedAt: now };
        adminBtn.style.display = 'none';
    }
}

function stableStringify(value) {
    const seen = new WeakSet();
    const helper = (v) => {
        if (v === null || typeof v !== 'object') return v;
        if (seen.has(v)) return null;
        seen.add(v);

        if (Array.isArray(v)) return v.map(helper);

        const out = {};
        for (const key of Object.keys(v).sort()) {
            out[key] = helper(v[key]);
        }
        return out;
    };
    return JSON.stringify(helper(value));
}

async function sha256Hex(text) {
    const enc = new TextEncoder();
    const bytes = enc.encode(String(text));
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCanonicalSnapshotForBilling() {
    const s = collectCVData();
    // Remove volatile ids + AI suggestion drafts so the same content hashes identically across sessions.
    return {
        personalInfo: s.personalInfo,
        includeReferences: Boolean(s.includeReferences),
        includeCoverLetter: Boolean(s.includeCoverLetter),
        skills: Array.isArray(s.skills) ? s.skills : [],
        hobbies: Array.isArray(s.hobbies) ? s.hobbies : [],
        experience: Array.isArray(s.experience)
            ? s.experience.map((e) => ({
                title: e?.title || '',
                company: e?.company || '',
                location: e?.location || '',
                startDate: e?.startDate || '',
                endDate: e?.endDate || '',
                current: Boolean(e?.current),
                responsibilities: Array.isArray(e?.responsibilities) ? e.responsibilities : []
            }))
            : [],
        education: Array.isArray(s.education)
            ? s.education.map((e) => ({
                degree: e?.degree || '',
                institution: e?.institution || '',
                location: e?.location || '',
                graduationDate: e?.graduationDate || ''
            }))
            : [],
        certifications: Array.isArray(s.certifications)
            ? s.certifications.map((c) => ({
                name: c?.name || '',
                issuer: c?.issuer || '',
                year: c?.year || ''
            }))
            : [],
        languages: Array.isArray(s.languages)
            ? s.languages.map((l) => ({
                language: l?.language || '',
                proficiency: l?.proficiency || ''
            }))
            : [],
        references: Array.isArray(s.references)
            ? s.references.map((r) => ({
                name: r?.name || '',
                title: r?.title || '',
                organization: r?.organization || '',
                phone: r?.phone || '',
                email: r?.email || ''
            }))
            : [],
        // Billing should reflect what gets downloaded, not the pasted job description.
        coverLetter: {
            role: String(s?.coverLetterRole || ''),
            company: String(s?.coverLetterCompany || ''),
            text: String(s?.coverLetterText || '')
        }
    };
}

function getCanonicalSnapshotForCvBilling() {
    const s = collectCVData();
    return {
        personalInfo: s.personalInfo,
        includeReferences: Boolean(s.includeReferences),
        skills: Array.isArray(s.skills) ? s.skills : [],
        hobbies: Array.isArray(s.hobbies) ? s.hobbies : [],
        experience: Array.isArray(s.experience)
            ? s.experience.map((e) => ({
                title: e?.title || '',
                company: e?.company || '',
                location: e?.location || '',
                startDate: e?.startDate || '',
                endDate: e?.endDate || '',
                current: Boolean(e?.current),
                responsibilities: Array.isArray(e?.responsibilities) ? e.responsibilities : []
            }))
            : [],
        education: Array.isArray(s.education)
            ? s.education.map((e) => ({
                degree: e?.degree || '',
                institution: e?.institution || '',
                location: e?.location || '',
                graduationDate: e?.graduationDate || ''
            }))
            : [],
        certifications: Array.isArray(s.certifications)
            ? s.certifications.map((c) => ({
                name: c?.name || '',
                issuer: c?.issuer || '',
                year: c?.year || ''
            }))
            : [],
        languages: Array.isArray(s.languages)
            ? s.languages.map((l) => ({
                language: l?.language || '',
                proficiency: l?.proficiency || ''
            }))
            : [],
        references: Array.isArray(s.references)
            ? s.references.map((r) => ({
                name: r?.name || '',
                title: r?.title || '',
                organization: r?.organization || '',
                phone: r?.phone || '',
                email: r?.email || ''
            }))
            : []
    };
}

function getCanonicalSnapshotForCoverBilling() {
    const s = collectCVData();
    return {
        personalInfo: s.personalInfo,
        coverLetter: {
            role: String(s?.coverLetterRole || ''),
            company: String(s?.coverLetterCompany || ''),
            text: String(s?.coverLetterText || '')
        }
    };
}

function getSelectedDownloadProduct() {
    const checked = document.querySelector('input[name="downloadProduct"]:checked');
    const v = (checked?.value || 'cv').toString();
    if (v === 'cv' || v === 'cover' || v === 'bundle') return v;
    return 'cv';
}

function getPriceZmwForProduct(product) {
    const cvPrice = typeof CV_PRICE_ZMW !== 'undefined' ? Number(CV_PRICE_ZMW) : 50;
    const coverPrice = typeof COVER_LETTER_PRICE_ZMW !== 'undefined' ? Number(COVER_LETTER_PRICE_ZMW) : 30;
    const bundlePrice = typeof BUNDLE_PRICE_ZMW !== 'undefined' ? Number(BUNDLE_PRICE_ZMW) : 70;

    if (product === 'cover') return Number.isFinite(coverPrice) ? coverPrice : 30;
    if (product === 'bundle') return Number.isFinite(bundlePrice) ? bundlePrice : 70;
    return Number.isFinite(cvPrice) ? cvPrice : 50;
}

let entitlementCache = { paidHash: null, paidCvHash: null, paidCoverHash: null, paidAt: null, fetchedAt: 0 };
async function getEntitlement() {
    const user = getCurrentUser();
    if (!user) return { paidHash: null, paidCvHash: null, paidCoverHash: null, paidAt: null };
    const now = Date.now();
    if (entitlementCache.fetchedAt && now - entitlementCache.fetchedAt < 15_000) {
        return {
            paidHash: entitlementCache.paidHash,
            paidCvHash: entitlementCache.paidCvHash,
            paidCoverHash: entitlementCache.paidCoverHash,
            paidAt: entitlementCache.paidAt
        };
    }
    const data = await fetchWithAuth('/.netlify/functions/cv-entitlement', { method: 'GET' });
    entitlementCache = {
        paidHash: data?.paidHash || null,
        paidCvHash: data?.paidCvHash || data?.paidHash || null,
        paidCoverHash: data?.paidCoverHash || null,
        paidAt: data?.paidAt || null,
        fetchedAt: now
    };
    return {
        paidHash: entitlementCache.paidHash,
        paidCvHash: entitlementCache.paidCvHash,
        paidCoverHash: entitlementCache.paidCoverHash,
        paidAt: entitlementCache.paidAt
    };
}

async function markPaidForCurrentSnapshot(snapshotHash, payment = null) {
    const data = await fetchWithAuth('/.netlify/functions/cv-mark-paid', {
        method: 'POST',
        body: JSON.stringify({ snapshotHash, payment })
    });
    entitlementCache = {
        paidHash: data?.paidHash || snapshotHash,
        paidCvHash: data?.paidCvHash || data?.paidHash || snapshotHash,
        paidCoverHash: data?.paidCoverHash || null,
        paidAt: data?.paidAt || null,
        fetchedAt: Date.now()
    };
    return data;
}

async function markPaidForCurrentPurchase(purchase, payment = null) {
    const payload = {
        product: purchase?.product || 'cv',
        cvHash: purchase?.cvHash || null,
        coverHash: purchase?.coverHash || null,
        payment
    };
    const data = await fetchWithAuth('/.netlify/functions/cv-mark-paid', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    entitlementCache = {
        paidHash: data?.paidHash || entitlementCache.paidHash || null,
        paidCvHash: data?.paidCvHash || entitlementCache.paidCvHash || null,
        paidCoverHash: data?.paidCoverHash || entitlementCache.paidCoverHash || null,
        paidAt: data?.paidAt || null,
        fetchedAt: Date.now()
    };
    return data;
}

let entitlementUiRaf = 0;
function scheduleEntitlementUiRefresh() {
    if (entitlementUiRaf) cancelAnimationFrame(entitlementUiRaf);
    entitlementUiRaf = requestAnimationFrame(() => {
        entitlementUiRaf = 0;
        refreshEntitlementUi().catch(() => {});
    });
}

async function refreshEntitlementUi() {
    const user = getCurrentUser();
    const downloadText = document.getElementById('downloadText');
    const statusEl = document.getElementById('accountStatus');

    // Keep price labels in sync
    try {
        const elCv = document.getElementById('priceCv');
        const elCover = document.getElementById('priceCover');
        const elBundle = document.getElementById('priceBundle');
        if (elCv) elCv.textContent = `ZMW ${getPriceZmwForProduct('cv')}`;
        if (elCover) elCover.textContent = `ZMW ${getPriceZmwForProduct('cover')}`;
        if (elBundle) elBundle.textContent = `ZMW ${getPriceZmwForProduct('bundle')}`;
    } catch {}

    const product = getSelectedDownloadProduct();
    const amountZmw = getPriceZmwForProduct(product);
    const label = product === 'cover' ? 'Cover Letter' : product === 'bundle' ? 'Bundle' : 'CV';

    if (!user) {
        if (downloadText) downloadText.textContent = `💰 Pay ZMW ${amountZmw} & Download ${label}`;
        return;
    }

    const cvHash = await sha256Hex(stableStringify(getCanonicalSnapshotForCvBilling()));
    const coverHash = await sha256Hex(stableStringify(getCanonicalSnapshotForCoverBilling()));
    const ent = await getEntitlement();

    const cvOk = Boolean(ent?.paidCvHash) && ent.paidCvHash === cvHash;
    const coverOk = Boolean(ent?.paidCoverHash) && ent.paidCoverHash === coverHash;
    const isFree = product === 'bundle' ? (cvOk && coverOk) : product === 'cover' ? coverOk : cvOk;

    if (downloadText) {
        downloadText.textContent = isFree
            ? `⬇️ Download ${label} (Free re-download)`
            : `💰 Pay ZMW ${amountZmw} & Download ${label}`;
    }

    if (statusEl) {
        const base = statusEl.textContent.split(' • ')[0];
        statusEl.textContent = `${base} • ${isFree ? 'Free re-download enabled for this selection' : 'Edits detected: payment required to download'}`;
    }
}

async function saveCvSnapshot() {
    const snapshot = collectCVData();
    return fetchWithAuth('/.netlify/functions/cv-save', {
        method: 'POST',
        body: JSON.stringify({ snapshot })
    });
}

function normalizeId(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : Date.now();
}

function applySnapshotToForm(snapshot) {
    const s = snapshot || {};
    const p = s.personalInfo || {};

    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value == null ? '' : String(value);
    };

    setVal('fullName', p.fullName);
    setVal('email', p.email);
    setVal('phone', p.phone);
    setVal('profession', p.profession);
    setVal('yearsExperience', p.yearsExperience);
    setVal('specialization', p.specialization);
    setVal('address', p.address);
    setVal('city', p.city);
    setVal('country', p.country || 'Zambia');
    setVal('summary', p.summary);

    // Cover letter fields
    const cl = s.coverLetter && typeof s.coverLetter === 'object' ? s.coverLetter : {};
    setVal('coverRole', cl.role);
    setVal('coverCompany', cl.company);
    setVal('coverJobDesc', cl.jobDescription);
    setVal('coverLetterText', cl.text);
    const includeCoverEl = document.getElementById('includeCoverLetter');
    if (includeCoverEl) includeCoverEl.checked = Boolean(cl.includeInPdf);

    const includeReferencesEl = document.getElementById('includeReferences');
    if (includeReferencesEl) includeReferencesEl.checked = Boolean(s.includeReferences);

    cvData.skills = Array.isArray(s.skills) ? s.skills.map((x) => String(x || '').trim()).filter(Boolean) : [];
    cvData.hobbies = Array.isArray(s.hobbies) ? s.hobbies.map((x) => String(x || '').trim()).filter(Boolean) : [];

    cvData.experience = Array.isArray(s.experience)
        ? s.experience.map((e) => ({
            id: normalizeId(e?.id),
            title: String(e?.title || ''),
            company: String(e?.company || ''),
            location: String(e?.location || ''),
            startDate: String(e?.startDate || ''),
            endDate: String(e?.endDate || ''),
            current: Boolean(e?.current),
            responsibilities: Array.isArray(e?.responsibilities) ? e.responsibilities.map((r) => String(r || '').trim()).filter(Boolean) : [],
            responsibilitySuggestions: []
        }))
        : [];

    cvData.education = Array.isArray(s.education)
        ? s.education.map((e) => ({
            id: normalizeId(e?.id),
            degree: String(e?.degree || ''),
            institution: String(e?.institution || ''),
            location: String(e?.location || ''),
            graduationDate: String(e?.graduationDate || '')
        }))
        : [];

    cvData.certifications = Array.isArray(s.certifications)
        ? s.certifications.map((c) => ({
            id: normalizeId(c?.id),
            name: String(c?.name || ''),
            issuer: String(c?.issuer || ''),
            year: String(c?.year || '')
        }))
        : [];

    cvData.languages = Array.isArray(s.languages)
        ? s.languages.map((l) => ({
            id: normalizeId(l?.id),
            language: String(l?.language || ''),
            proficiency: String(l?.proficiency || '')
        }))
        : [];

    cvData.references = Array.isArray(s.references)
        ? s.references.map((r) => ({
            id: normalizeId(r?.id),
            name: String(r?.name || ''),
            title: String(r?.title || ''),
            organization: String(r?.organization || ''),
            phone: String(r?.phone || ''),
            email: String(r?.email || '')
        }))
        : [];

    renderSkills();
    renderSkillSuggestions();
    renderHobbies();
    renderExperience();
    renderEducation();
    renderCertifications();
    renderLanguages();
    renderReferences();
    updatePreview();

    scheduleEntitlementUiRefresh();
}

async function loadSavedCv() {
    try {
        const data = await fetchWithAuth('/.netlify/functions/cv-load', { method: 'GET' });
        applySnapshotToForm(data?.snapshot);
        showToast('Saved CV loaded.', 'success');
    } catch (e) {
        showToast(e?.message || 'No saved CV found for this account.', 'info');
    }
}

async function saveCvNow() {
    try {
        await requireLogin();
        await saveCvSnapshot();
        showToast('CV saved to your account.', 'success');
    } catch (e) {
        showToast(e?.message || 'Failed to save CV.', 'error');
    }
}

function formatMonthYear(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^([0-9]{4})-([0-9]{2})$/);
    if (!match) return raw;
    const year = match[1];
    const month = Number.parseInt(match[2], 10);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = months[month - 1];
    if (!monthName) return raw;
    return `${monthName} ${year}`;
}

function formatDateRange(startDate, endDate, current) {
    const start = formatMonthYear((startDate || '').trim());
    const end = current ? 'Present' : formatMonthYear((endDate || '').trim());
    if (!start && !end) return '';
    if (start && !end) return start;
    if (!start && end) return end;
    return `${start} - ${end}`;
}

function updatePreview() {
    const preview = document.getElementById('cvPreview');
    if (!preview) return;

    const data = collectCVData();
    const includeReferences = Boolean(document.getElementById('includeReferences')?.checked);
    const includeCoverLetter = Boolean(document.getElementById('includeCoverLetter')?.checked);

    const contact = [
        data.personalInfo.email,
        data.personalInfo.phone,
        [data.personalInfo.city, data.personalInfo.country].filter(Boolean).join(', '),
    ].filter(Boolean).join(' | ');

    const skillsHtml = data.skills?.length
        ? `<ul class="cv-skills-grid">${data.skills.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
        : '<div class="help-text">Add skills to see them here.</div>';

    const expHtml = data.experience?.length
        ? data.experience.map((exp) => {
            const titleLine = [exp.title, exp.company].filter(Boolean).join(' — ');
            const dateLine = formatDateRange(exp.startDate, exp.endDate, exp.current);
            const locationLine = String(exp.location || '').trim();
            const metaLine = [dateLine, locationLine].filter(Boolean).join(' | ');
            const responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
            const respHtml = responsibilities.length
                ? `<ul>${responsibilities.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
                : '<div class="help-text">Add duties/responsibilities for ATS impact.</div>';
            return `
                <div class="cv-item">
                    <div><strong>${escapeHtml(titleLine || 'Position')}</strong></div>
                    ${metaLine ? `<div class="cv-contact">${escapeHtml(metaLine)}</div>` : ''}
                    ${respHtml}
                </div>
            `;
        }).join('')
        : '<div class="help-text">Add work experience entries.</div>';

    const eduHtml = data.education?.length
        ? `<ul>${data.education.map((edu) => {
            const left = edu.degree || 'Qualification';
            const right = [edu.institution, String(edu.location || '').trim(), formatMonthYear(edu.graduationDate)].filter(Boolean).join(' | ');
            return `<li><strong>${escapeHtml(left)}</strong>${right ? ` — ${escapeHtml(right)}` : ''}</li>`;
        }).join('')}</ul>`
        : '<div class="help-text">Add education to complete your CV.</div>';

    const certHtml = data.certifications?.length
        ? `<ul>${data.certifications.map((c) => {
            const main = c.name || 'Certification/License';
            const meta = [c.issuer, c.year].filter(Boolean).join(' | ');
            return `<li><strong>${escapeHtml(main)}</strong>${meta ? ` — ${escapeHtml(meta)}` : ''}</li>`;
        }).join('')}</ul>`
        : '';

    const langHtml = data.languages?.length
        ? `<ul>${data.languages.map((l) => {
            const main = l.language || 'Language';
            const meta = l.proficiency ? ` — ${l.proficiency}` : '';
            return `<li><strong>${escapeHtml(main)}</strong>${meta ? escapeHtml(meta) : ''}</li>`;
        }).join('')}</ul>`
        : '';

    const hobbiesHtml = data.hobbies?.length
        ? `<ul>${data.hobbies.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
        : '';

    const refsHtml = includeReferences
        ? (data.references?.length
            ? data.references.map((r) => {
                const name = r.name || 'Reference';
                const meta = [r.title, r.organization].filter(Boolean).join(', ');
                const contact = [r.phone, r.email].filter(Boolean).join(' | ');
                return `
                    <div class="cv-item">
                        <div><strong>${escapeHtml(name)}</strong>${meta ? ` — ${escapeHtml(meta)}` : ''}</div>
                        ${contact ? `<div class="cv-contact">${escapeHtml(contact)}</div>` : ''}
                    </div>
                `;
            }).join('')
            : '<div>Available upon request</div>')
        : '';

    const summaryHtml = data.personalInfo.summary
        ? `<div>${escapeHtml(data.personalInfo.summary)}</div>`
        : '<div class="help-text">Generate or type your summary to see it here.</div>';

    const coverLetterText = String(data.coverLetterText || '').trim();
    const coverLetterRole = String(data.coverLetterRole || '').trim();
    const coverLetterCompany = String(data.coverLetterCompany || '').trim();
    const coverTitle = [coverLetterRole || 'Cover Letter', coverLetterCompany].filter(Boolean).join(' — ');
    const coverLetterHtml = (includeCoverLetter && coverLetterText)
        ? `<div class="cv-section" id="cvCoverLetterSection">
                <div class="cv-section-title">Cover Letter</div>
                <div class="cv-contact">${escapeHtml(coverTitle)}</div>
                <div style="white-space: pre-wrap;">${escapeHtml(coverLetterText)}</div>
            </div>`
        : '';

    preview.innerHTML = `
        <div class="cv-name">${escapeHtml(data.personalInfo.fullName || 'Your Name')}</div>
        ${contact ? `<div class="cv-contact">${escapeHtml(contact)}</div>` : '<div class="cv-contact">Add contact details for preview.</div>'}

        <div class="cv-section" id="cvSummarySection">
            <div class="cv-section-title">Professional Summary</div>
            ${summaryHtml}
        </div>

        <div class="cv-section" id="cvSkillsSection">
            <div class="cv-section-title">Skills</div>
            ${skillsHtml}
        </div>

        <div class="cv-section" id="cvExperienceSection">
            <div class="cv-section-title">Work Experience</div>
            ${expHtml}
        </div>

        <div class="cv-section" id="cvEducationSection">
            <div class="cv-section-title">Education</div>
            ${eduHtml}
        </div>

        ${certHtml ? `
            <div class="cv-section">
                <div class="cv-section-title">Certifications & Licensing</div>
                ${certHtml}
            </div>
        ` : ''}

        ${langHtml ? `
            <div class="cv-section">
                <div class="cv-section-title">Languages</div>
                ${langHtml}
            </div>
        ` : ''}

        ${hobbiesHtml ? `
            <div class="cv-section">
                <div class="cv-section-title">Hobbies</div>
                ${hobbiesHtml}
            </div>
        ` : ''}

        ${refsHtml ? `
            <div class="cv-section">
                <div class="cv-section-title">References</div>
                ${refsHtml}
            </div>
        ` : ''}

        ${coverLetterHtml}
    `;
}

// Step-by-step wizard (makes the form feel more professional)
const wizardState = {
    steps: [],
    currentIndex: 0,
};

function getWizardTitle(stepEl) {
    if (!stepEl) return '';
    const fromData = stepEl.getAttribute('data-title');
    if (fromData) return fromData;
    const h2 = stepEl.querySelector('h2');
    return (h2?.textContent || '').trim();
}

function validateWizardStep(index) {
    const stepEl = wizardState.steps[index];
    if (!stepEl) return true;

    const required = Array.from(stepEl.querySelectorAll('input[required], textarea[required], select[required]'));
    for (const el of required) {
        if (typeof el.checkValidity === 'function' && !el.checkValidity()) {
            const label = stepEl.querySelector(`label[for="${el.id}"]`)?.textContent?.replace('*', '').trim();
            showToast(label ? `Please complete: ${label}` : (el.validationMessage || 'Please complete the required fields'), 'error');
            try { el.focus(); } catch {}
            return false;
        }
    }

    return true;
}

function renderWizardStepper() {
    const stepper = document.getElementById('wizardStepper');
    if (!stepper) return;

    stepper.innerHTML = wizardState.steps
        .map((step, i) => {
            const title = escapeHtml(getWizardTitle(step) || `Step ${i + 1}`);
            return `<button type="button" class="wizard-step" id="wizardStepBtn-${i}" aria-label="Go to ${title}" title="${title}"><span class="wizard-step-num">${i + 1}</span><span class="wizard-step-label">${title}</span></button>`;
        })
        .join('');

    wizardState.steps.forEach((_, i) => {
        const btn = document.getElementById(`wizardStepBtn-${i}`);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (i > wizardState.currentIndex && !validateWizardStep(wizardState.currentIndex)) return;
            goToWizardStep(i);
        });
    });
}

function updateWizardUI() {
    const total = wizardState.steps.length;
    const current = wizardState.currentIndex;
    const currentTitle = getWizardTitle(wizardState.steps[current]);

    const progress = document.getElementById('wizardProgress');
    if (progress) {
        progress.textContent = `Step ${current + 1} of ${total} • ${currentTitle}`;
    }

    const prevBtn = document.getElementById('wizardPrev');
    const nextBtn = document.getElementById('wizardNext');
    if (prevBtn) prevBtn.disabled = current === 0;

    if (nextBtn) {
        if (current >= total - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-flex';
            const nextTitle = getWizardTitle(wizardState.steps[current + 1]);
            nextBtn.textContent = nextTitle ? `Next: ${nextTitle} →` : 'Next →';
        }
    }

    wizardState.steps.forEach((step, i) => {
        step.classList.toggle('is-active', i === current);
        const btn = document.getElementById(`wizardStepBtn-${i}`);
        if (btn) {
            btn.classList.toggle('is-active', i === current);
            btn.classList.toggle('is-complete', i < current);
        }
    });

    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
        const top = formContainer.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, top - 14), behavior: 'smooth' });
    }
}

function goToWizardStep(index) {
    const total = wizardState.steps.length;
    const next = Math.max(0, Math.min(index, total - 1));
    wizardState.currentIndex = next;
    updateWizardUI();
}

function initWizard() {
    wizardState.steps = Array.from(document.querySelectorAll('.form-container .form-step'));
    if (!wizardState.steps.length) return;

    renderWizardStepper();

    const prevBtn = document.getElementById('wizardPrev');
    const nextBtn = document.getElementById('wizardNext');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => goToWizardStep(wizardState.currentIndex - 1));
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!validateWizardStep(wizardState.currentIndex)) return;
            goToWizardStep(wizardState.currentIndex + 1);
        });
    }

    // Default to first step
    wizardState.currentIndex = 0;
    updateWizardUI();
}

// Toast notifications
function showToast(message, type = 'info') {
    try {
        if (typeof window.Toastify !== 'function') {
            // Fallback (keeps app usable if CDN fails)
            if (type === 'error') console.error(message);
            else console.log(message);
            return;
        }

        window.Toastify({
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
        }).showToast();
    } catch (err) {
        console.error('Toast error:', err);
    }
}

// Add Skill
function addSkill() {
    const input = document.getElementById('skillInput');
    const skill = input.value.trim();
    
    if (skill && !cvData.skills.includes(skill)) {
        cvData.skills.push(skill);
        renderSkills();
        input.value = '';
    }
}

// Remove Skill
function removeSkill(skill) {
    cvData.skills = cvData.skills.filter(s => s !== skill);
    renderSkills();
}

// Edit Skill
function editSkill(oldSkill) {
    const current = String(oldSkill || '').trim();
    if (!current) return;

    const next = window.prompt('Edit skill:', current);
    if (next === null) return;
    const updated = String(next).trim();
    if (!updated) {
        showToast('Skill cannot be empty', 'error');
        return;
    }

    const exists = cvData.skills.some((s) => String(s).toLowerCase() === updated.toLowerCase());
    if (exists && updated.toLowerCase() !== current.toLowerCase()) {
        showToast('That skill already exists', 'error');
        return;
    }

    cvData.skills = cvData.skills.map((s) => (s === oldSkill ? updated : s));
    renderSkills();
}

// Render Skills
function renderSkills() {
    const container = document.getElementById('skillsList');
    container.innerHTML = cvData.skills.map(skill => `
        <span class="tag" role="button" tabindex="0" title="Click to edit" onclick="editSkill('${skill.replace(/'/g, "\\'")}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editSkill('${skill.replace(/'/g, "\\'")}')}">
            ${escapeHtml(skill)}
            <button type="button" onclick="event.stopPropagation(); removeSkill('${skill.replace(/'/g, "\\'")}')" class="tag-remove">×</button>
        </span>
    `).join('');

    schedulePreviewUpdate();
}

// Hobbies (Optional)
function addHobby() {
    const input = document.getElementById('hobbyInput');
    if (!input) return;
    const hobby = input.value.trim();
    if (hobby && !cvData.hobbies.includes(hobby)) {
        cvData.hobbies.push(hobby);
        renderHobbies();
        input.value = '';
    }
}

function removeHobby(hobby) {
    cvData.hobbies = cvData.hobbies.filter((h) => h !== hobby);
    renderHobbies();
}

function renderHobbies() {
    const container = document.getElementById('hobbiesList');
    if (!container) return;
    container.innerHTML = cvData.hobbies.map(hobby => `
        <span class="tag">
            ${escapeHtml(hobby)}
            <button type="button" onclick="removeHobby('${hobby.replace(/'/g, "\\'")}')" class="tag-remove">×</button>
        </span>
    `).join('');
    schedulePreviewUpdate();
}

// Responsibilities / Duties (per experience)
function addResponsibility(expId) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp) return;

    const input = document.getElementById(`respInput-${expId}`);
    const text = (input?.value || '').trim();
    if (!text) return;

    exp.responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
    if (!exp.responsibilities.includes(text)) {
        exp.responsibilities.push(text);
    }
    if (input) input.value = '';
    renderExperience();
}

function removeResponsibility(expId, index) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp || !Array.isArray(exp.responsibilities)) return;
    exp.responsibilities.splice(index, 1);
    renderExperience();
}

function editResponsibility(expId, index) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp || !Array.isArray(exp.responsibilities)) return;
    const current = String(exp.responsibilities[index] || '').trim();
    if (!current) return;

    const next = window.prompt('Edit duty/responsibility:', current);
    if (next === null) return;
    const updated = String(next).trim();
    if (!updated) {
        showToast('Duty cannot be empty', 'error');
        return;
    }

    // Prevent duplicates in this job
    const exists = exp.responsibilities.some((r, i) => i !== index && String(r).toLowerCase() === updated.toLowerCase());
    if (exists) {
        showToast('That duty already exists for this job', 'error');
        return;
    }

    exp.responsibilities[index] = updated;
    renderExperience();
}

function parseBulletLines(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*•\s\d.()]+\s*/, '').trim())
        .filter((line) => line.length >= 8);
}

async function generateResponsibilities(expId) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp) return;

    const profession = document.getElementById('profession')?.value?.trim();
    const yearsExperience = document.getElementById('yearsExperience')?.value;

    if (!exp.title && !profession) {
        showToast('Add a job title (or profession) first', 'error');
        return;
    }

    const btn = document.getElementById(`respAiBtn-${expId}`);
    const loading = document.getElementById(`respAiLoading-${expId}`);
    const text = document.getElementById(`respAiText-${expId}`);
    if (btn && loading && text) {
        loading.style.display = 'inline';
        text.style.display = 'none';
        btn.disabled = true;
    }

    try {
        const title = exp.title || profession || 'the role';
        const company = exp.company ? ` at ${exp.company}` : '';
        const locationHint = 'Zambia';
        const basePrompt = `Write 6 to 8 high-impact CV bullet points for responsibilities/duties for a ${title}${company} in ${locationHint}.

Requirements:
- Output 6-8 bullet points
- Each bullet must start with a strong action verb (e.g., Led, Managed, Delivered, Implemented)
- Use ATS-friendly wording (no emojis, no fancy symbols)
- Prefer measurable impact where reasonable (numbers, time, volume)
- Keep each bullet 12-22 words
- Past tense unless currently working

Return ONLY the bullet list, one bullet per line. No intro or outro text.`;

        const response = await fetch('/.netlify/functions/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: basePrompt,
                type: 'responsibilities',
                model: 'gemini-2.0-flash'
            })
        });
        const data = await response.json();

        if (!data.success || !data.text) {
            showToast(data.error || 'Failed to generate responsibilities', 'error');
            return;
        }

        const bullets = parseBulletLines(data.text);
        if (!bullets.length) {
            showToast('No usable bullet points were returned. Try again.', 'error');
            return;
        }

        exp.responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
        exp.responsibilitySuggestions = Array.isArray(exp.responsibilitySuggestions) ? exp.responsibilitySuggestions : [];

        const existing = new Set(exp.responsibilities.map((r) => String(r).toLowerCase()));
        const uniq = [...new Set(bullets)].filter((b) => !existing.has(String(b).toLowerCase()));

        exp.responsibilitySuggestions = uniq;
        renderExperience();
        showToast('Duties generated. Click Add to apply.', 'success');
    } catch (error) {
        console.error('Responsibilities Generation Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        if (btn && loading && text) {
            loading.style.display = 'none';
            text.style.display = 'inline';
            btn.disabled = false;
        }
    }
}

function addSuggestedResponsibility(expId, text) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp) return;
    const duty = String(text || '').trim();
    if (!duty) return;

    exp.responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
    const exists = exp.responsibilities.some((r) => String(r).toLowerCase() === duty.toLowerCase());
    if (!exists) exp.responsibilities.push(duty);

    exp.responsibilitySuggestions = Array.isArray(exp.responsibilitySuggestions)
        ? exp.responsibilitySuggestions.filter((r) => String(r).toLowerCase() !== duty.toLowerCase())
        : [];

    renderExperience();
    requestAnimationFrame(() => bumpPreviewSection('cvExperienceSection'));
}

function addAllSuggestedResponsibilities(expId) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp) return;
    const suggestions = Array.isArray(exp.responsibilitySuggestions) ? exp.responsibilitySuggestions : [];
    if (!suggestions.length) return;

    exp.responsibilities = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
    const existing = new Set(exp.responsibilities.map((r) => String(r).toLowerCase()));
    for (const s of suggestions) {
        const duty = String(s || '').trim();
        if (!duty) continue;
        if (!existing.has(duty.toLowerCase())) exp.responsibilities.push(duty);
    }

    exp.responsibilitySuggestions = [];
    renderExperience();
    requestAnimationFrame(() => bumpPreviewSection('cvExperienceSection'));
}

function clearSuggestedResponsibilities(expId) {
    const exp = cvData.experience.find((e) => e.id === expId);
    if (!exp) return;
    exp.responsibilitySuggestions = [];
    renderExperience();
}

// Certifications & Licensing (Optional)
function addCertification() {
    const id = Date.now();
    cvData.certifications.push({ id, name: '', issuer: '', year: '' });
    renderCertifications();
}

function removeCertification(id) {
    cvData.certifications = cvData.certifications.filter((c) => c.id !== id);
    renderCertifications();
}

function updateCertification(id, field, value) {
    const cert = cvData.certifications.find((c) => c.id === id);
    if (cert) {
        cert[field] = value;
        updatePreview();
    }
}

function renderCertifications() {
    const container = document.getElementById('certificationsList');
    if (!container) return;
    container.innerHTML = cvData.certifications.map((cert, index) => `
        <div class="education-item">
            <h3>Certification/License ${index + 1}</h3>
            <div class="form-group">
                <label>Name</label>
                <input type="text" value="${escapeHtml(cert.name)}" onchange="updateCertification(${cert.id}, 'name', this.value)">
            </div>
            <div class="form-group">
                <label>Issuer (Optional)</label>
                <input type="text" value="${escapeHtml(cert.issuer)}" onchange="updateCertification(${cert.id}, 'issuer', this.value)">
            </div>
            <div class="form-group">
                <label>Year (Optional)</label>
                <input type="text" value="${escapeHtml(cert.year)}" onchange="updateCertification(${cert.id}, 'year', this.value)">
            </div>
            <button type="button" class="btn-danger" onclick="removeCertification(${cert.id})">Remove</button>
        </div>
    `).join('');
    schedulePreviewUpdate();
}

// Languages (Optional)
function addLanguage() {
    const id = Date.now();
    cvData.languages.push({ id, language: '', proficiency: '' });
    renderLanguages();
}

function removeLanguage(id) {
    cvData.languages = cvData.languages.filter((l) => l.id !== id);
    renderLanguages();
}

function updateLanguage(id, field, value) {
    const lang = cvData.languages.find((l) => l.id === id);
    if (lang) {
        lang[field] = value;
        updatePreview();
    }
}

function renderLanguages() {
    const container = document.getElementById('languagesList');
    if (!container) return;
    container.innerHTML = cvData.languages.map((lang, index) => `
        <div class="education-item">
            <h3>Language ${index + 1}</h3>
            <div class="form-group">
                <label>Language</label>
                <input type="text" value="${escapeHtml(lang.language)}" onchange="updateLanguage(${lang.id}, 'language', this.value)">
            </div>
            <div class="form-group">
                <label>Proficiency (Optional)</label>
                <input type="text" placeholder="e.g., Native, Fluent, Intermediate" value="${escapeHtml(lang.proficiency)}" onchange="updateLanguage(${lang.id}, 'proficiency', this.value)">
            </div>
            <button type="button" class="btn-danger" onclick="removeLanguage(${lang.id})">Remove</button>
        </div>
    `).join('');
    schedulePreviewUpdate();
}

// References (Optional)
function addReference() {
    const id = Date.now();
    cvData.references.push({ id, name: '', title: '', organization: '', phone: '', email: '' });
    renderReferences();
}

function removeReference(id) {
    cvData.references = cvData.references.filter((r) => r.id !== id);
    renderReferences();
}

function updateReference(id, field, value) {
    const ref = cvData.references.find((r) => r.id === id);
    if (ref) {
        ref[field] = value;
        updatePreview();
    }
}

function renderReferences() {
    const container = document.getElementById('referencesList');
    if (!container) return;
    container.innerHTML = cvData.references.map((ref, index) => `
        <div class="education-item">
            <h3>Reference ${index + 1}</h3>
            <div class="form-group">
                <label>Name</label>
                <input type="text" value="${escapeHtml(ref.name)}" onchange="updateReference(${ref.id}, 'name', this.value)">
            </div>
            <div class="form-group">
                <label>Title (Optional)</label>
                <input type="text" value="${escapeHtml(ref.title)}" onchange="updateReference(${ref.id}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>Organization (Optional)</label>
                <input type="text" value="${escapeHtml(ref.organization)}" onchange="updateReference(${ref.id}, 'organization', this.value)">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Phone (Optional)</label>
                    <input type="text" value="${escapeHtml(ref.phone)}" onchange="updateReference(${ref.id}, 'phone', this.value)">
                </div>
                <div class="form-group">
                    <label>Email (Optional)</label>
                    <input type="text" value="${escapeHtml(ref.email)}" onchange="updateReference(${ref.id}, 'email', this.value)">
                </div>
            </div>
            <button type="button" class="btn-danger" onclick="removeReference(${ref.id})">Remove</button>
        </div>
    `).join('');
    schedulePreviewUpdate();
}

// Generate Summary (Using Netlify Function)
async function generateSummary() {
    const profession = document.getElementById('profession').value.trim();
    const yearsExperience = document.getElementById('yearsExperience').value;
    const specialization = document.getElementById('specialization').value.trim();
    
    if (!profession) {
        showToast('Please enter your profession first', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('summaryLoading');
    const textSpan = document.getElementById('summaryText');
    loadingSpan.style.display = 'inline';
    textSpan.style.display = 'none';
    
    try {
        const basePrompt = `Generate a professional CV summary for a ${profession} with ${yearsExperience} years of experience in Zambia.
        
${specialization ? `Specialization: ${specialization}` : ''}

Requirements:
- Write 3 to 4 sentences (NOT fewer than 3)
- Professional and confident tone
- Highlight key strengths relevant to Zambian job market
- Include career goals
- Focus on value proposition to employers

Return ONLY the summary text, no headings, no bullet points, no quotes.`;

        const countSentences = (text) => {
            const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
            if (!cleaned) return 0;
            // Rough sentence count based on terminal punctuation.
            const matches = cleaned.match(/[.!?](\s|$)/g);
            return matches ? matches.length : 1;
        };

        const callSuggestionService = async (prompt) => {
            const response = await fetch('/.netlify/functions/generate-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    type: 'summary',
                    // Gemini 2.0 flash avoids large "thought" budgets that can truncate output
                    model: 'gemini-2.0-flash'
                })
            });
            return response.json();
        };

        let data = await callSuggestionService(basePrompt);
        if (data.success && data.text) {
            // If the model returns fewer than 3 sentences, retry once with stricter instructions.
            if (countSentences(data.text) < 3) {
                const retryPrompt = `${basePrompt}

IMPORTANT: Output exactly 4 sentences. Do not output fewer than 3 sentences.`;
                data = await callSuggestionService(retryPrompt);
            }
        }

        if (data.success && data.text) {
            showSummarySuggestion(data.text);
            showToast('Summary generated. Click Add to apply.', 'success');
        } else {
            showToast(data.error || 'Failed to generate summary', 'error');
        }
    } catch (error) {
        console.error('Summary Generation Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        loadingSpan.style.display = 'none';
        textSpan.style.display = 'inline';
    }
}

// Suggest Skills (Using Netlify Function)
async function generateSkills() {
    const profession = document.getElementById('profession').value.trim();
    const yearsExperience = document.getElementById('yearsExperience').value;
    
    if (!profession) {
        showToast('Please enter your profession first', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('skillsLoading');
    const textSpan = document.getElementById('skillsText');
    loadingSpan.style.display = 'inline';
    textSpan.style.display = 'none';
    
    try {
        const basePrompt = `List 8-12 key professional skills for a ${profession} with ${yearsExperience} years of experience in Zambia.

Requirements:
- Return at least 8 skills and at most 12 skills
- Return ONLY a comma + space separated list
- No numbering, no bullet points, no extra sentences
Example: Project Management, Team Leadership, Communication`;

        const callSuggestionService = async (prompt) => {
            const response = await fetch('/.netlify/functions/generate-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    type: 'skills',
                    // Skills generation works best on Gemini 2.0 flash (avoids large "thought" budgets)
                    model: 'gemini-2.0-flash'
                })
            });
            return response.json();
        };

        let data = await callSuggestionService(basePrompt);
        let skills = [];
        if (data.success && data.text) {
            const skillsText = String(data.text);
            skills = skillsText
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s && s.length <= 60);

            // Retry once if we got too few skills.
            if (skills.length < 8) {
                const retryPrompt = `${basePrompt}

IMPORTANT: Return exactly 10 skills as comma + space separated values. No other text.`;
                data = await callSuggestionService(retryPrompt);
                if (data.success && data.text) {
                    skills = String(data.text)
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s && s.length <= 60);
                }
            }
        }

        if (data.success && skills.length) {
            const existing = new Set(cvData.skills.map((s) => String(s).toLowerCase()));
            cvData.skillSuggestions = skills
                .map((s) => String(s || '').trim())
                .filter(Boolean)
                .filter((s) => !existing.has(s.toLowerCase()));
            renderSkillSuggestions();
            showToast('Skills suggested. Click Add to apply.', 'success');
        } else {
            showToast(data.error || 'Failed to generate skills', 'error');
        }
    } catch (error) {
        console.error('Skills Suggestion Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        loadingSpan.style.display = 'none';
        textSpan.style.display = 'inline';
    }
}

// Generate Cover Letter (Using Netlify Function)
async function generateCoverLetter() {
    const fullName = document.getElementById('fullName')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const phone = document.getElementById('phone')?.value?.trim();
    const profession = document.getElementById('profession')?.value?.trim();
    const yearsExperience = document.getElementById('yearsExperience')?.value;

    const role = document.getElementById('coverRole')?.value?.trim();
    const company = document.getElementById('coverCompany')?.value?.trim();
    const jobDesc = document.getElementById('coverJobDesc')?.value?.trim();

    if (!profession && !role) {
        showToast('Enter your profession (or target role) first', 'error');
        return;
    }
    if (!jobDesc && !role && !company) {
        showToast('Add a target role, company, or paste a job description', 'error');
        return;
    }

    const loadingSpan = document.getElementById('coverLoading');
    const textSpan = document.getElementById('coverText');
    if (loadingSpan) loadingSpan.style.display = 'inline';
    if (textSpan) textSpan.style.display = 'none';

    try {
        const target = role || profession || 'the role';
        const companyLine = company ? ` at ${company}` : '';
        const contactLine = [email, phone].filter(Boolean).join(' | ');
        const jdBlock = jobDesc ? `\n\nJob description (for tailoring):\n${jobDesc}` : '';

        const prompt = `Write a professional cover letter for a job application in Zambia.

Candidate:
- Name: ${fullName || 'Candidate'}
- Profession: ${profession || 'N/A'}
- Experience: ${yearsExperience ? `${yearsExperience} years` : 'N/A'}
- Contact: ${contactLine || 'N/A'}

Target role: ${target}${companyLine}
${jdBlock}

Requirements:
- 3 to 5 short paragraphs
- ATS-friendly wording (no emojis, no fancy symbols)
- Mention the target role and why the candidate is a fit
- Include 2-3 relevant achievements or strengths (keep them believable)
- End with a confident closing and the candidate name

Return ONLY the cover letter text. No subject line. No bullet points.`;

        const response = await fetch('/.netlify/functions/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                type: 'coverletter',
                model: 'gemini-2.0-flash'
            })
        });
        const data = await response.json();

        if (data.success && data.text) {
            showCoverLetterSuggestion(data.text);
            showToast('Cover letter generated. Click Add to apply.', 'success');
        } else {
            showToast(data.error || 'Failed to generate cover letter', 'error');
        }
    } catch (error) {
        console.error('Cover Letter Generation Error:', error);
        showToast('Failed to connect to the suggestion service', 'error');
    } finally {
        if (loadingSpan) loadingSpan.style.display = 'none';
        if (textSpan) textSpan.style.display = 'inline';
    }
}

// Add Experience Entry
function addExperience() {
    const id = Date.now();
    cvData.experience.push({ id, title: '', company: '', location: '', startDate: '', endDate: '', current: false, responsibilities: [], responsibilitySuggestions: [] });
    renderExperience();
}

// Remove Experience
function removeExperience(id) {
    cvData.experience = cvData.experience.filter(exp => exp.id !== id);
    renderExperience();
}

// Render Experience
function renderExperience() {
    const container = document.getElementById('experienceList');
    container.innerHTML = cvData.experience.map((exp, index) => `
        <div class="experience-item">
            <h3>Experience ${index + 1}</h3>
            <div class="form-group">
                <label>Job Title</label>
                <input type="text" value="${exp.title}" onchange="updateExperience(${exp.id}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" value="${exp.company}" onchange="updateExperience(${exp.id}, 'company', this.value)">
            </div>
            <div class="form-group">
                <label>Location (Town/City, Country)</label>
                <input type="text" value="${escapeHtml(exp.location || '')}" placeholder="e.g., Lusaka, Zambia" onchange="updateExperience(${exp.id}, 'location', this.value)">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="month" value="${exp.startDate}" onchange="updateExperience(${exp.id}, 'startDate', this.value)">
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="month" value="${exp.endDate}" ${exp.current ? 'disabled' : ''} onchange="updateExperience(${exp.id}, 'endDate', this.value)">
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" ${exp.current ? 'checked' : ''} onchange="updateExperience(${exp.id}, 'current', this.checked)">
                    Currently working here
                </label>
            </div>

            <div class="form-group">
                <label>Duties / Responsibilities (Bulleted)</label>
                <div class="skill-input-group">
                    <input type="text" id="respInput-${exp.id}" placeholder="e.g., Managed patient triage and coordinated referrals to improve care flow">
                    <button type="button" onclick="addResponsibility(${exp.id})">Add</button>
                </div>
                <button type="button" class="btn-ai" id="respAiBtn-${exp.id}" onclick="generateResponsibilities(${exp.id})">
                    <span id="respAiLoading-${exp.id}" class="loading" style="display: none;">⏳ Generating...</span>
                    <span id="respAiText-${exp.id}">✨ Generate Duties</span>
                </button>
                <div class="suggestions-wrap" style="display: ${(Array.isArray(exp.responsibilitySuggestions) && exp.responsibilitySuggestions.length) ? 'block' : 'none'};">
                    <div class="suggestions-header">
                        <div class="suggestions-title">Suggested duties</div>
                        <div class="suggestions-actions">
                            <button type="button" class="btn-secondary btn-mini" onclick="addAllSuggestedResponsibilities(${exp.id})">Add all</button>
                            <button type="button" class="btn-secondary btn-mini" onclick="clearSuggestedResponsibilities(${exp.id})">Clear</button>
                        </div>
                    </div>
                    <div class="tags-container">
                        ${(Array.isArray(exp.responsibilitySuggestions) ? exp.responsibilitySuggestions : []).map((r) => {
                            const safe = String(r || '');
                            return `
                                <span class="tag tag-suggestion">
                                    ${escapeHtml(safe)}
                                    <button type="button" class="tag-add" title="Add" onclick="addSuggestedResponsibility(${exp.id}, '${safe.replace(/'/g, "\\'")}')">+</button>
                                </span>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="tags-container">
                    ${(Array.isArray(exp.responsibilities) ? exp.responsibilities : []).map((r, i) => `
                        <span class="tag" role="button" tabindex="0" title="Click to edit" onclick="editResponsibility(${exp.id}, ${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editResponsibility(${exp.id}, ${i})}">
                            ${escapeHtml(r)}
                            <button type="button" class="tag-remove" onclick="event.stopPropagation(); removeResponsibility(${exp.id}, ${i})">×</button>
                        </span>
                    `).join('')}
                </div>
                <p class="help-text">Tip: Click a duty to edit it. Use 6-8 bullets with action verbs and measurable outcomes.</p>
            </div>
            <button type="button" class="btn-danger" onclick="removeExperience(${exp.id})">Remove</button>
        </div>
    `).join('');

    schedulePreviewUpdate();
}

// Update Experience
function updateExperience(id, field, value) {
    const exp = cvData.experience.find(e => e.id === id);
    if (exp) {
        exp[field] = value;
        if (field === 'current' && value) {
            exp.endDate = '';
        }
        // Avoid re-rendering the entire experience list for simple typing.
        // Only re-render when toggling "current" so the end-date input disables/enables.
        if (field === 'current') {
            renderExperience();
        } else {
            schedulePreviewUpdate();
        }
    }
}

// Add Education Entry
function addEducation() {
    const id = Date.now();
    cvData.education.push({ id, degree: '', institution: '', location: '', graduationDate: '' });
    renderEducation();
}

// Remove Education
function removeEducation(id) {
    cvData.education = cvData.education.filter(edu => edu.id !== id);
    renderEducation();
}

// Render Education
function renderEducation() {
    const container = document.getElementById('educationList');
    container.innerHTML = cvData.education.map((edu, index) => `
        <div class="education-item">
            <h3>Education ${index + 1}</h3>
            <div class="form-group">
                <label>Degree/Certification</label>
                <input type="text" value="${edu.degree}" onchange="updateEducation(${edu.id}, 'degree', this.value)">
            </div>
            <div class="form-group">
                <label>Institution</label>
                <input type="text" value="${edu.institution}" onchange="updateEducation(${edu.id}, 'institution', this.value)">
            </div>
            <div class="form-group">
                <label>Location (Town/City, Country)</label>
                <input type="text" value="${escapeHtml(edu.location || '')}" placeholder="e.g., Lusaka, Zambia" onchange="updateEducation(${edu.id}, 'location', this.value)">
            </div>
            <div class="form-group">
                <label>Graduation Date</label>
                <input type="month" value="${edu.graduationDate}" onchange="updateEducation(${edu.id}, 'graduationDate', this.value)">
            </div>
            <button type="button" class="btn-danger" onclick="removeEducation(${edu.id})">Remove</button>
        </div>
    `).join('');

    schedulePreviewUpdate();
}

// Update Education
function updateEducation(id, field, value) {
    const edu = cvData.education.find(e => e.id === id);
    if (edu) {
        edu[field] = value;
    }
    schedulePreviewUpdate();
}

// Collect CV Data
function collectCVData() {
    return {
        personalInfo: {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            profession: document.getElementById('profession').value.trim(),
            yearsExperience: document.getElementById('yearsExperience').value,
            specialization: document.getElementById('specialization').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            country: document.getElementById('country').value.trim(),
            summary: document.getElementById('summary').value.trim()
        },
        skills: cvData.skills,
        experience: cvData.experience,
        education: cvData.education,
        certifications: cvData.certifications,
        languages: cvData.languages,
        hobbies: cvData.hobbies,
        references: cvData.references,
        includeReferences: Boolean(document.getElementById('includeReferences')?.checked),
        includeCoverLetter: Boolean(document.getElementById('includeCoverLetter')?.checked),
        coverLetterRole: document.getElementById('coverRole')?.value?.trim() || '',
        coverLetterCompany: document.getElementById('coverCompany')?.value?.trim() || '',
        coverLetterJobDesc: document.getElementById('coverJobDesc')?.value?.trim() || '',
        coverLetterText: document.getElementById('coverLetterText')?.value?.trim() || '',
        coverLetter: {
            role: document.getElementById('coverRole')?.value?.trim() || '',
            company: document.getElementById('coverCompany')?.value?.trim() || '',
            jobDescription: document.getElementById('coverJobDesc')?.value?.trim() || '',
            text: document.getElementById('coverLetterText')?.value?.trim() || '',
            includeInPdf: Boolean(document.getElementById('includeCoverLetter')?.checked)
        }
    };
}

// Generate PDF (Client-side using jsPDF)
function generatePDF(data, options = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const includeCv = options?.includeCv !== false;
    const includeCoverLetter =
        typeof options?.includeCoverLetter === 'boolean'
            ? options.includeCoverLetter
            : Boolean(data.includeCoverLetter);
    
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    if (!includeCv) {
        const headerName = (data.personalInfo.fullName || '').trim() || 'Your Name';
        const headerContact = [
            (data.personalInfo.email || '').trim(),
            (data.personalInfo.phone || '').trim(),
            [data.personalInfo.city, data.personalInfo.country].filter(Boolean).join(', ')
        ].filter(Boolean).join(' • ');

        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text(headerName, margin, yPos);
        yPos += 8;

        if (headerContact) {
            doc.setFontSize(10);
            doc.text(headerContact, margin, yPos);
            yPos += 10;
        } else {
            yPos += 6;
        }

        const role = String(data.coverLetterRole || '').trim();
        const company = String(data.coverLetterCompany || '').trim();
        const meta = [role || 'Cover Letter', company].filter(Boolean).join(' — ');

        doc.setFontSize(13);
        doc.text(meta, margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        const body = String(data.coverLetterText || '').trim();
        const bodyLines = doc.splitTextToSize(body || ' ', contentWidth);
        for (const line of bodyLines) {
            if (yPos > 275) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, margin, yPos);
            yPos += 5;
        }

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('Powered by Glamified Systems • CVPro Zambia', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        return doc;
    }
    
    // Header (ATS-friendly: keep it simple)
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(data.personalInfo.fullName || 'Your Name', margin, yPos);
    yPos += 10;
    
    // Contact Info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const contactInfo = [
        data.personalInfo.email,
        data.personalInfo.phone,
        data.personalInfo.city && data.personalInfo.country 
            ? `${data.personalInfo.city}, ${data.personalInfo.country}` 
            : (data.personalInfo.city || data.personalInfo.country)
    ].filter(Boolean).join(' • ');
    doc.text(contactInfo, margin, yPos);
    yPos += 10;
    
    yPos += 4;
    
    // Professional Summary
    if (data.personalInfo.summary) {
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Professional Summary', margin, yPos);
        yPos += 7;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const summaryLines = doc.splitTextToSize(data.personalInfo.summary, contentWidth);
        doc.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 5 + 10;
    }
    
    // Skills
    if (data.skills.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Skills', margin, yPos);
        yPos += 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        // Two-column skills (ATS-friendly): draw plain text in two x positions (no tables/text boxes)
        const skills = data.skills.map((s) => String(s || '').trim()).filter(Boolean);
        const gap = 10;
        const columnWidth = (contentWidth - gap) / 2;
        const leftX = margin;
        const rightX = margin + columnWidth + gap;
        const startY = yPos;

        // Put first half in left column, second half in right column.
        const mid = Math.ceil(skills.length / 2);
        const left = skills.slice(0, mid);
        const right = skills.slice(mid);

        let yLeft = startY;
        left.forEach((skill) => {
            const lines = doc.splitTextToSize(`• ${skill}`, columnWidth);
            doc.text(lines, leftX, yLeft);
            yLeft += lines.length * 5;
        });

        let yRight = startY;
        right.forEach((skill) => {
            const lines = doc.splitTextToSize(`• ${skill}`, columnWidth);
            doc.text(lines, rightX, yRight);
            yRight += lines.length * 5;
        });

        yPos = Math.max(yLeft, yRight) + 8;
    }
    
    // Work Experience
    if (data.experience.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Work Experience', margin, yPos);
        yPos += 10;
        
        data.experience.forEach(exp => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(exp.title || 'Position', margin, yPos);
            yPos += 6;
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            const dateRange = exp.current 
                ? `${formatMonthYear(exp.startDate)} - Present` 
                : `${formatMonthYear(exp.startDate)} - ${formatMonthYear(exp.endDate)}`;
            const expMeta = [String(exp.company || '').trim(), dateRange, String(exp.location || '').trim()].filter(Boolean).join(' | ');
            doc.text(expMeta || dateRange, margin, yPos);
            yPos += 10;

            // Responsibilities bullets
            const duties = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];
            if (duties.length) {
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                duties.forEach((duty) => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }
                    const dutyLines = doc.splitTextToSize(`• ${duty}`, contentWidth);
                    doc.text(dutyLines, margin, yPos);
                    yPos += dutyLines.length * 5;
                });
                yPos += 8;
            }
        });
    }

    // Certifications & Licensing (Optional)
    if (Array.isArray(data.certifications) && data.certifications.length > 0) {
        if (yPos > 260) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Certifications & Licensing', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        data.certifications.forEach((c) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            const main = (c?.name || '').trim();
            const meta = [c?.issuer, c?.year].map((v) => (v || '').trim()).filter(Boolean).join(' | ');
            const lineText = `• ${main || 'Certification/License'}${meta ? ` — ${meta}` : ''}`;
            const lines = doc.splitTextToSize(lineText, contentWidth);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 5;
        });
        yPos += 8;
    }

    // Languages (Optional)
    if (Array.isArray(data.languages) && data.languages.length > 0) {
        if (yPos > 260) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Languages', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        data.languages.forEach((l) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            const language = (l?.language || '').trim() || 'Language';
            const proficiency = (l?.proficiency || '').trim();
            const lineText = `• ${language}${proficiency ? ` — ${proficiency}` : ''}`;
            const lines = doc.splitTextToSize(lineText, contentWidth);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 5;
        });
        yPos += 8;
    }

    // Hobbies (Optional)
    if (Array.isArray(data.hobbies) && data.hobbies.length > 0) {
        if (yPos > 260) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Hobbies', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        data.hobbies.forEach((hobby) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            const lines = doc.splitTextToSize(`• ${String(hobby || '').trim()}`, contentWidth);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 5;
        });
        yPos += 8;
    }

    // References (Optional)
    if (data.includeReferences) {
        if (yPos > 260) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('References', margin, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const refs = Array.isArray(data.references) ? data.references : [];
        if (!refs.length) {
            doc.text('Available upon request', margin, yPos);
            yPos += 10;
        } else {
            refs.forEach((r) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                const name = (r?.name || '').trim() || 'Reference';
                const meta = [r?.title, r?.organization].map((v) => (v || '').trim()).filter(Boolean).join(', ');
                const contact = [r?.phone, r?.email].map((v) => (v || '').trim()).filter(Boolean).join(' | ');

                const headerLine = `• ${name}${meta ? ` — ${meta}` : ''}`;
                const headerLines = doc.splitTextToSize(headerLine, contentWidth);
                doc.text(headerLines, margin, yPos);
                yPos += headerLines.length * 5;

                if (contact) {
                    const contactLines = doc.splitTextToSize(`  ${contact}`, contentWidth);
                    doc.text(contactLines, margin, yPos);
                    yPos += contactLines.length * 5;
                }

                yPos += 4;
            });
            yPos += 6;
        }
    }

    // Cover Letter (Optional)
    if (includeCoverLetter && String(data.coverLetterText || '').trim()) {
        if (includeCv) doc.addPage();
        yPos = 20;

        const headerName = (data.personalInfo.fullName || '').trim() || 'Your Name';
        const headerContact = [
            (data.personalInfo.email || '').trim(),
            (data.personalInfo.phone || '').trim(),
            [data.personalInfo.city, data.personalInfo.country].filter(Boolean).join(', ')
        ].filter(Boolean).join(' • ');

        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text(headerName, margin, yPos);
        yPos += 8;

        if (headerContact) {
            doc.setFontSize(10);
            doc.text(headerContact, margin, yPos);
            yPos += 10;
        } else {
            yPos += 6;
        }

        const role = String(data.coverLetterRole || '').trim();
        const company = String(data.coverLetterCompany || '').trim();
        const meta = [role || 'Cover Letter', company].filter(Boolean).join(' — ');

        doc.setFontSize(13);
        doc.text(meta, margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        const body = String(data.coverLetterText || '').trim();
        const bodyLines = doc.splitTextToSize(body, contentWidth);
        for (const line of bodyLines) {
            if (yPos > 275) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, margin, yPos);
            yPos += 5;
        }

        yPos += 6;
    }
    
    // Education
    if (data.education.length > 0) {
        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Education', margin, yPos);
        yPos += 10;
        
        data.education.forEach(edu => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(edu.degree || 'Degree', margin, yPos);
            yPos += 6;
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            const grad = formatMonthYear(edu.graduationDate);
            const eduMeta = [String(edu.institution || '').trim(), String(edu.location || '').trim(), grad].filter(Boolean).join(' | ');
            doc.text(eduMeta, margin, yPos);
            yPos += 10;
        });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Powered by Glamified Systems • CVPro Zambia', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    
    return doc;
}

// Handle Download with Payment (Standalone Mode)
async function handleDownload() {
    const data = collectCVData();
    
    // Validation
    if (!data.personalInfo.fullName || !data.personalInfo.email) {
        showToast('Please fill in at least your name and email before downloading.', 'error');
        return;
    }
    
    const loadingSpan = document.getElementById('downloadLoading');
    const textSpan = document.getElementById('downloadText');
    const user = getCurrentUser();
    if (loadingSpan) loadingSpan.style.display = 'inline';
    if (textSpan) textSpan.style.display = 'none';
    
    try {
        const product = getSelectedDownloadProduct();
        const amountZmw = getPriceZmwForProduct(product);
        const label = product === 'cover' ? 'Cover Letter' : product === 'bundle' ? 'Bundle' : 'CV';
        const reference = (product === 'cover' ? 'COVER' : product === 'bundle' ? 'BUNDLE' : 'CV') + '-' + Date.now();

        // Load heavy 3rd-party scripts only when the user downloads.
        await ensureJsPdfLoaded();

        if (product !== 'cv' && !String(data.coverLetterText || '').trim()) {
            showToast('Please add a cover letter before downloading this option.', 'error');
            if (loadingSpan) loadingSpan.style.display = 'none';
            if (textSpan) textSpan.style.display = 'inline';
            return;
        }

        // Logged-in users: if the selection hasn't changed since last successful payment,
        // allow a free re-download.
        let cvHash = null;
        let coverHash = null;
        if (user) {
            cvHash = await sha256Hex(stableStringify(getCanonicalSnapshotForCvBilling()));
            coverHash = await sha256Hex(stableStringify(getCanonicalSnapshotForCoverBilling()));
            const ent = await getEntitlement();

            const cvOk = Boolean(ent?.paidCvHash) && ent.paidCvHash === cvHash;
            const coverOk = Boolean(ent?.paidCoverHash) && ent.paidCoverHash === coverHash;
            const canFreeDownload = product === 'bundle' ? (cvOk && coverOk) : product === 'cover' ? coverOk : cvOk;

            if (canFreeDownload) {
                const includeCv = product !== 'cover';
                const includeCoverLetter = product !== 'cv';
                const pdf = generatePDF(data, { includeCv, includeCoverLetter });
                const safeName = data.personalInfo.fullName.replace(/\s+/g, '_');
                const fileName =
                    product === 'cover'
                        ? `Cover_Letter_${safeName}.pdf`
                        : product === 'bundle'
                            ? `CV_and_Cover_Letter_${safeName}.pdf`
                            : `CV_${safeName}.pdf`;
                pdf.save(fileName);
                saveCvSnapshot().catch(() => {});
                showToast(`Downloaded ${label} (free re-download).`, 'success');
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.style.display = 'inline';
                scheduleEntitlementUiRefresh();
                return;
            }
        }

        // Not paid for these edits — require payment.
        await ensureLencoLoaded();
        
        window.LencoPay.getPaid({
            key: LENCO_PUBLIC_KEY,
            reference: reference,
            email: data.personalInfo.email,
            amount: amountZmw,
            currency: 'ZMW',
            channels: ['mobile-money'],
            customer: {
                name: data.personalInfo.fullName,
                phone: data.personalInfo.phone
            },
            onSuccess: function(response) {
                showToast(`Payment successful! Generating your ${label}...`, 'success');
                
                const includeCv = product !== 'cover';
                const includeCoverLetter = product !== 'cv';
                const pdf = generatePDF(data, { includeCv, includeCoverLetter });
                const safeName = data.personalInfo.fullName.replace(/\s+/g, '_');
                const fileName =
                    product === 'cover'
                        ? `Cover_Letter_${safeName}.pdf`
                        : product === 'bundle'
                            ? `CV_and_Cover_Letter_${safeName}.pdf`
                            : `CV_${safeName}.pdf`;
                pdf.save(fileName);

                if (user) {
                    markPaidForCurrentPurchase({ product, cvHash, coverHash }, {
                        provider: 'lenco',
                        reference,
                        amount: amountZmw,
                        currency: 'ZMW',
                        status: 'paid'
                    }).then(
                        () => scheduleEntitlementUiRefresh(),
                        () => {}
                    );

                    saveCvSnapshot().catch(() => {});
                } else {
                    setTimeout(() => {
                        try {
                            const ok = window.confirm('Downloaded! Want to sign up to save and re-download for free next time?');
                            if (ok) openSignup();
                        } catch {}
                    }, 200);
                }
                
                showToast(`${label} downloaded successfully!`, 'success');
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.style.display = 'inline';
            },
            onClose: function() {
                showToast('Payment cancelled', 'info');
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.style.display = 'inline';
            },
            onConfirmationPending: function() {
                showToast('Payment pending. We will process your download once confirmed.', 'info');
                
                // Generate PDF anyway after a delay
                setTimeout(() => {
                    const includeCv = product !== 'cover';
                    const includeCoverLetter = product !== 'cv';
                    const pdf = generatePDF(data, { includeCv, includeCoverLetter });
                    const safeName = data.personalInfo.fullName.replace(/\s+/g, '_');
                    const fileName =
                        product === 'cover'
                            ? `Cover_Letter_${safeName}.pdf`
                            : product === 'bundle'
                                ? `CV_and_Cover_Letter_${safeName}.pdf`
                                : `CV_${safeName}.pdf`;
                    pdf.save(fileName);

                    if (user) {
                        saveCvSnapshot().catch(() => {});
                    } else {
                        setTimeout(() => {
                            try {
                                const ok = window.confirm('Downloaded! Want to sign up to save and re-download for free next time?');
                                if (ok) openSignup();
                            } catch {}
                        }, 200);
                    }
                    showToast(`${label} downloaded! Payment confirmation pending.`, 'success');
                    if (loadingSpan) loadingSpan.style.display = 'none';
                    if (textSpan) textSpan.style.display = 'inline';
                }, 3000);
            }
        });
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment/PDF system not loaded. Please try again.', 'error');
        if (loadingSpan) loadingSpan.style.display = 'none';
        if (textSpan) textSpan.style.display = 'inline';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Netlify Identity (optional: enables save/load and free re-downloads)
    const idw = getIdentityWidget();
    if (idw?.init) {
        try {
            idw.init();
        } catch {}

        try {
            idw.on('init', (user) => setAccountUi({ user }));
            idw.on('login', (user) => {
                setAccountUi({ user });
                showToast('Logged in successfully.', 'success');
                scheduleEntitlementUiRefresh();
            });
            idw.on('logout', () => {
                setAccountUi({ user: null });
                showToast('Logged out.', 'info');
            });
        } catch {}
    }

    // Render initial account state (in case Identity is disabled)
    setAccountUi({ user: getCurrentUser() });

    // Add enter key support for skill input
    const skillInput = document.getElementById('skillInput');
    if (skillInput) {
        skillInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
            }
        });
    }
    
    // Live preview updates on typing
    const previewIds = [
        'fullName','email','phone','profession','yearsExperience','specialization',
        'address','city','country','summary'
    ];
    previewIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', schedulePreviewUpdate);
            el.addEventListener('change', schedulePreviewUpdate);
        }
    });

    const hobbyInput = document.getElementById('hobbyInput');
    if (hobbyInput) {
        hobbyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addHobby();
            }
        });
    }

    // Initialize optional sections UI
    renderCertifications();
    renderLanguages();
    renderHobbies();
    renderReferences();

    updatePreview();

    // Wizard UI (step-by-step navigation)
    initWizard();
});
