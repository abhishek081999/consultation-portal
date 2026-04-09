// =====================================================================
// JYOTISH ADMIN PORTAL - script.js
// Data Source: Live Google Spreadsheet
// Spreadsheet ID: 1SpdyxWW0cHxDUUuy6VrquASgBjucEpFAFPJuuXuSKNU
// =====================================================================

// =====================================================================
//  STATE
// =====================================================================
let allData = [];
let allConsultants = [];
let currentFilter = 'all';
let currentCampaignFilter = 'all';
let currentConsultantFilter = 'all';
let currentGenderFilter = 'all';
let currentEditingId = null;
let searchQuery = '';
let currentUser = null; // { name, role }
let currentMyStatusFilter = 'all';

const GS_ID = '1SpdyxWW0cHxDUUuy6VrquASgBjucEpFAFPJuuXuSKNU';
const FETCH_URL_HANUMAN = `https://docs.google.com/spreadsheets/d/${GS_ID}/gviz/tq?tqx=out:csv&sheet=Assignee%20of%20Hanuman&headers=1`;
const FETCH_URL_CONSULTANTS = `https://docs.google.com/spreadsheets/d/${GS_ID}/gviz/tq?tqx=out:csv&sheet=Consultant_List&headers=1`;

// --- SYNC API URL ---
// Paste your Web App URL from 'Extensions > Apps Script > Deploy' here to enable BI-DIRECTIONAL SYNC
const SYNC_URL = "https://script.google.com/macros/s/AKfycbyxTc04uW1GfIGehgQ4eo6iIyeP_v--GpRfID15zLAMJcUVVS8kw1qMYxBkhsc3kfLU5Q/exec"; 

// =====================================================================
//  INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupNavigation();
    setupFilters();
    setupSearch();
    setupModal();
    loadLiveGSData();
    setupMobileMenu();
    checkAuth();

    if (!SYNC_URL) {
        console.warn('SYNC_URL is missing. Changes will be local-only. Follow SYNC_SETUP.md.');
    }

    document.getElementById('refreshBtn').addEventListener('click', () => {
        document.getElementById('refreshBtn').classList.add('spinning');
        loadLiveGSData();
        setTimeout(() => document.getElementById('refreshBtn').classList.remove('spinning'), 800);
    });

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('myStatusFilter')?.addEventListener('change', e => {
        currentMyStatusFilter = e.target.value;
        renderMyConsultations();
    });
});

// =====================================================================
//  CSV PARSER (Vanilla JS)
// =====================================================================
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentValue += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            currentRow.push(currentValue.trim());
            currentValue = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && nextChar === "\n") i++;
            currentRow.push(currentValue.trim());
            if (currentRow.some(c => c !== "")) rows.push(currentRow);
            currentRow = [];
            currentValue = "";
        } else {
            currentValue += char;
        }
    }
    if (currentRow.length > 0 || currentValue !== "") {
        currentRow.push(currentValue.trim());
        if (currentRow.some(c => c !== "")) rows.push(currentRow);
    }
    return rows;
}

// =====================================================================
//  LOAD FROM GOOGLE SHEETS
// =====================================================================
async function loadLiveGSData() {
    const statusDot = document.getElementById('connectionStatus');
    statusDot.title = 'Fetching live data...';
    
    try {
        // Parallel fetch for speed
        const [resHanuman, resConsultants] = await Promise.all([
            fetch(FETCH_URL_HANUMAN, { cache: "no-store" }).then(r => r.text()),
            fetch(FETCH_URL_CONSULTANTS, { cache: "no-store" }).then(r => r.text())
        ]);

        const rowsHanuman = parseCSV(resHanuman);
        const rowsConsultants = parseCSV(resConsultants);

        // Map Consultants
        // Headers: Batch | Participants | Contat detail
        allConsultants = rowsConsultants.slice(1).map(r => ({
            name:  r[1] || '',
            batch: r[0] || 'General',
            phone: r[2] || ''
        })).filter(c => c.name);

        // Map Hanuman requests
        // Headers: S.No | Name | Number | Gender | DOB | Time | Place | Type | Query 1 | Query 2 | Consultant | Foundation | Foundation 2 | Status | First Pref | Feedback | Notes
        allData = rowsHanuman.slice(1).map((r, idx) => {
            const statusLabels = ['Done', 'Allocated', 'DNP', 'Refund', 'Allotment Changed'];
            
            // Find status dynamically
            let status = 'Pending';
            for (let sIdx of [13, 12, 11]) {
                let val = (r[sIdx] || '').trim();
                if (statusLabels.includes(val)) { status = val; break; }
            }

            // Clean foundations so they don't contain status words
            let f1 = (r[11] || '').trim();
            let f2 = (r[12] || '').trim();
            if (statusLabels.includes(f1)) f1 = '';
            if (statusLabels.includes(f2)) f2 = '';

            return {
                id:            'h' + (r[0] || idx),
                rowNum:        (r[0] || '').trim(),
                campaign:      'Hanuman Jayanti',
                clientName:    (r[1] || '').trim(),
                phone:         String(r[2] || '').trim(),
                gender:        (r[3] || '').trim(),
                dob:           (r[4] || '').trim(),
                time:          (r[5] || '').trim(),
                place:         (r[6] || '').trim(),
                package_:      (r[7] || '').trim(),
                concern:       (r[8] || '').trim(),
                queryDetail:   (r[9] || '').trim(),
                consultant:    (r[10] || '').trim(),
                foundation:    f1,
                foundation2:   f2,
                status:        status,
                firstPref:     (r[14] || '').trim(),
                feedback:      (r[15] || '').trim(),
                notes:         (r[16] || '').trim(),
                // Placeholders
                email:         '',
                clientType:    '',
                heardVia:      '',
                paymentMethod: '',
                screenshotUrl: '',
            };
        }).filter(r => r.clientName);

        statusDot.classList.remove('offline');
        statusDot.title = `Live Sync Active — ${allData.length} Hanuman records`;
        
        refreshAll();
        showToast('Synced ' + allData.length + ' records from Google Sheets', 'success');

    } catch (error) {
        console.error('GS Sync Error:', error);
        statusDot.classList.add('offline');
        statusDot.title = 'Sync failed: ' + error.message;
        showToast('Sync failed: Check console for CORS or sharing issues', 'error');
    }
}

// =====================================================================
//  NAVIGATION
// =====================================================================
function setupNavigation() {
    const pageTitles = { dashboard: 'Dashboard', requests: 'Consult Requests', consultants: 'Consultants', 'my-consultations': 'My Consultations' };

    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchView(e.currentTarget.dataset.view);
        });
    });

    document.querySelectorAll('.see-all-link[data-view]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchView(e.currentTarget.dataset.view);
        });
    });

    window.switchView = function(view) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById('nav-' + view)?.classList.add('active');
        document.querySelectorAll('.content-view').forEach(v => v.style.display = 'none');
        document.getElementById('view-' + view).style.display = '';
        document.getElementById('pageTitle').textContent = pageTitles[view] || 'Admin';
        
        if (view === 'consultants') renderConsultantViews();
        if (view === 'requests')    renderMainTable();
        if (view === 'dashboard')   { updateStats(); renderRecentTable(); renderConsultantViews(); }
        if (view === 'my-consultations') renderMyConsultations();

        // Mobile: Close menu after selection
        if (window.innerWidth <= 900) {
            document.getElementById('sidebar')?.classList.remove('open');
            document.querySelector('.sidebar-overlay')?.classList.remove('open');
        }
    };
}

// =====================================================================
//  LOGIN & AUTH
// =====================================================================
function setupLogin() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorEl  = document.getElementById('login-error');

        if (!username) return;

        // Simple auth as requested: Username = Password = Name
        if (username.toLowerCase() === 'admin') {
            handleLogin({ name: 'Admin', role: 'admin' });
        } else if (username === password) {
            handleLogin({ name: username, role: 'consultant' });
        } else {
            errorEl.textContent = 'Invalid credentials. Password must match Username.';
        }
    });
}

function handleLogin(user) {
    currentUser = user;
    localStorage.setItem('jyotish_user', JSON.stringify(user));
    applyRoleUI();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = '';
    
    if (user.role === 'admin') {
        switchView('dashboard');
    } else {
        switchView('my-consultations');
    }
    showToast('Welcome, ' + user.name + '!', 'success');
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('jyotish_user');
    document.getElementById('login-screen').style.display = '';
    document.getElementById('app-layout').style.display = 'none';
    document.body.className = '';
}

function checkAuth() {
    const stored = localStorage.getItem('jyotish_user');
    if (stored) {
        handleLogin(JSON.parse(stored));
    }
}

function applyRoleUI() {
    const user = currentUser;
    if (!user) return;
    
    document.body.className = 'role-' + user.role;
    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('userRoleDisplay').textContent = user.role === 'admin' ? 'Super Admin' : 'Consultant';
    document.getElementById('userInitial').textContent = user.name[0].toUpperCase();

    // Adjust sidebar navigation
    const navMenu = document.querySelector('.nav-menu');
    if (user.role === 'consultant') {
        // Build consultant menu if not already there
        if (!document.getElementById('nav-my-consultations')) {
            const link = document.createElement('a');
            link.href = "#";
            link.className = "nav-link active";
            link.id = "nav-my-consultations";
            link.dataset.view = "my-consultations";
            link.innerHTML = '<span class="nav-icon">🧘</span><span>My Consultations</span>';
            link.addEventListener('click', e => { e.preventDefault(); switchView('my-consultations'); });
            
            // Insert after MAIN label
            const label = navMenu.querySelector('.nav-section-label');
            label.after(link);
        }
    }
}

// =====================================================================
//  REFRESH
// =====================================================================
function refreshAll() {
    updateStats();
    renderRecentTable();
    renderMainTable();
    renderMyConsultations();
    renderConsultantViews();
    updateConsultantFilter();
    updateSidebarBadge();
}

// =====================================================================
//  STATS
// =====================================================================
function updateStats() {
    const data    = allData;
    const total   = data.length;
    const done    = data.filter(d => d.status === 'Done').length;
    const pending = data.filter(d => ['Pending','Allocated'].includes(d.status)).length;
    const dnp     = data.filter(d => ['DNP','Refund'].includes(d.status)).length;

    document.getElementById('totalRequests').textContent     = total;
    document.getElementById('completedRequests').textContent = done;
    document.getElementById('pendingAssignments').textContent = pending;
    document.getElementById('dnpCount').textContent          = dnp;
    document.getElementById('statCampaignBreak').textContent = 'Hanuman Jayanti Special';
}

function updateSidebarBadge() {
    const n = allData.filter(d => !['Done','DNP','Refund'].includes(d.status)).length;
    document.getElementById('sidebarPendingCount').textContent = n;
}

// =====================================================================
//  FILTERS
// =====================================================================
function getFilteredData() {
    return allData.filter(item => {
        if (currentCampaignFilter !== 'all' && item.campaign !== currentCampaignFilter) return false;
        if (currentFilter !== 'all' && item.status !== currentFilter) return false;
        if (currentConsultantFilter !== 'all' && 
            item.consultant !== currentConsultantFilter && 
            item.foundation !== currentConsultantFilter &&
            item.foundation2 !== currentConsultantFilter) return false;
        if (currentGenderFilter !== 'all' && item.gender.toLowerCase() !== currentGenderFilter.toLowerCase()) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const hay = [item.clientName, item.phone, item.email, item.concern, item.place, item.consultant, item.foundation, item.foundation2].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function setupFilters() {
    document.getElementById('campaignFilter')?.addEventListener('change', e => { currentCampaignFilter = e.target.value; updateStats(); renderRecentTable(); renderMainTable(); });
    document.getElementById('statusFilter')?.addEventListener('change', e => { currentFilter = e.target.value; renderMainTable(); });
    document.getElementById('consultantFilter')?.addEventListener('change', e => { currentConsultantFilter = e.target.value; renderMainTable(); });
    document.getElementById('genderFilter')?.addEventListener('change', e => { currentGenderFilter = e.target.value; renderMainTable(); });
}

function setupSearch() {
    let t;
    document.getElementById('searchInput')?.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { searchQuery = e.target.value.trim(); renderMainTable(); }, 200);
    });
}

// =====================================================================
//  TABLE RENDERING
// =====================================================================
function makeStatusBadge(status) {
    const map = { Done:'badge-done', Allocated:'badge-allocated', Pending:'badge-pending', DNP:'badge-dnp', Refund:'badge-refund', 'Allotment Changed':'badge-allotment' };
    return '<span class="badge ' + (map[status]||'badge-pending') + '">' + escHtml(status) + '</span>';
}

function makeCampaignBadge(campaign) {
    return '<span class="badge campaign-badge badge-hanuman">Hanuman</span>';
}

function renderRecentTable() {
    const tbody = document.getElementById('recentTableBody');
    if (!tbody) return;
    const rows = allData.slice(0, 15);
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No data</td></tr>'; return; }
    tbody.innerHTML = rows.map((row, i) =>
        '<tr>' +
        '<td style="color:var(--text-faint)">#' + escHtml(row.rowNum||String(i+1)) + '</td>' +
        '<td><strong>' + escHtml(row.clientName) + '</strong></td>' +
        '<td>' + makeCampaignBadge(row.campaign) + '</td>' +
        '<td style="color:var(--text-muted)">' + escHtml((row.concern||'').substring(0,30)) + '</td>' +
        '<td style="color:var(--text-faint);font-size:0.8rem">' + escHtml(row.package_||'—') + '</td>' +
        '<td>' + makeStatusBadge(row.status) + '</td>' +
        '<td>' + (row.consultant ? '<span style="color:var(--primary)">' + escHtml(row.consultant) + '</span>' : '<em style="color:var(--text-faint)">Unassigned</em>') + 
                 (row.foundation ? '<div style="font-size:0.7rem;color:var(--text-faint)">+ ' + escHtml(row.foundation) + '</div>' : '') + 
                 (row.foundation2 ? '<div style="font-size:0.7rem;color:var(--text-faint)">+ ' + escHtml(row.foundation2) + '</div>' : '') + '</td>' +
        '<td><button class="action-btn" onclick="openDetailModal(\'' + escHtml(row.id) + '\')">View</button></td>' +
        '</tr>'
    ).join('');
}

function renderMainTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const filtered = getFilteredData();
    document.getElementById('requestsSubtitle').textContent = 'Showing ' + filtered.length + ' of ' + allData.length + ' records';
    document.getElementById('tableCount').textContent = filtered.length + ' record' + (filtered.length !== 1 ? 's' : '');

    if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No records match your filters</td></tr>'; return; }

    tbody.innerHTML = filtered.map((row, i) =>
        '<tr>' +
        '<td style="color:var(--text-faint);width:40px">#' + escHtml(row.rowNum||String(i+1)) + '</td>' +
        '<td><div style="font-weight:600">' + escHtml(row.clientName) + '</div><div style="font-size:0.75rem;color:var(--text-faint)">' + escHtml(row.gender) + '</div></td>' +
        '<td style="font-family:monospace;font-size:0.83rem;color:var(--text-muted)">' + escHtml(row.phone) + '</td>' +
        '<td>' + makeCampaignBadge(row.campaign) + '</td>' +
        '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;color:var(--text-muted)">' + escHtml((row.concern||'').substring(0,28)) + '</td>' +
        '<td style="color:var(--text-faint);font-size:0.8rem;white-space:nowrap">' + escHtml(row.package_||'—') + '</td>' +
        '<td style="color:var(--text-muted);font-size:0.82rem">' + escHtml(row.dob||'—') + '</td>' +
        '<td>' + makeStatusBadge(row.status) + '</td>' +
        '<td>' + (row.consultant ? '<span style="color:var(--primary);font-weight:500">' + escHtml(row.consultant) + '</span>' : '<em style="color:var(--text-faint)">Unassigned</em>') +
                 (row.foundation  ? '<div style="font-size:0.72rem;color:var(--text-faint)">+ ' + escHtml(row.foundation) + '</div>' : '') + 
                 (row.foundation2 ? '<div style="font-size:0.72rem;color:var(--text-faint)">+ ' + escHtml(row.foundation2) + '</div>' : '') + '</td>' +
        '<td><button class="action-btn" onclick="openDetailModal(\'' + escHtml(row.id) + '\')">View &amp; Assign</button></td>' +
        '</tr>'
    ).join('');
}

function renderMyConsultations() {
    const tbody = document.getElementById('myConsultationsTableBody');
    if (!tbody || !currentUser) return;

    const myName = currentUser.name.toLowerCase().trim();
    let filtered = allData.filter(d => {
        const c1 = (d.consultant || '').toLowerCase().trim();
        const c2 = (d.foundation || '').toLowerCase().trim();
        const c3 = (d.foundation2 || '').toLowerCase().trim();
        return c1 === myName || c2 === myName || c3 === myName;
    });

    if (currentMyStatusFilter !== 'all') {
        filtered = filtered.filter(d => d.status === currentMyStatusFilter);
    }

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No consultations found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((row, i) => {
        let roleBadge = '';
        if (row.consultant.toLowerCase() === myName) roleBadge = '<span class="badge badge-hanuman">Primary</span>';
        else roleBadge = '<span class="badge badge-allocated">Foundation</span>';

        return '<tr>' +
            '<td style="color:var(--text-faint)">#' + escHtml(row.rowNum||String(i+1)) + '</td>' +
            '<td><div style="font-weight:600">' + escHtml(row.clientName) + '</div><div style="font-size:0.75rem;color:var(--text-faint)">' + escHtml(row.gender) + '</div></td>' +
            '<td>' + makeCampaignBadge(row.campaign) + '</td>' +
            '<td style="color:var(--text-muted);font-size:0.85rem">' + escHtml(row.concern) + '</td>' +
            '<td style="color:var(--text-muted);font-size:0.82rem">' + escHtml(row.dob) + '<div style="font-size:0.7rem">' + escHtml(row.place) + '</div></td>' +
            '<td>' + roleBadge + '</td>' +
            '<td>' + makeStatusBadge(row.status) + '</td>' +
            '<td>' + (row.feedback ? '<span style="font-size:0.8rem">' + escHtml(row.feedback) + '</span>' : '<em style="color:var(--text-faint)">None</em>') + '</td>' +
            '<td><button class="action-btn" onclick="openDetailModal(\'' + escHtml(row.id) + '\')">View/Feedback</button></td>' +
            '</tr>';
    }).join('');
}

// =====================================================================
//  CONSULTANT VIEWS
// =====================================================================
function renderConsultantViews() {
    // Dashboard mini-cards
    const summaryGrid = document.getElementById('consultantSummaryGrid');
    if (summaryGrid) {
        if (!allConsultants.length) {
            summaryGrid.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No consultant data.</p>';
        } else {
            summaryGrid.innerHTML = allConsultants.map(c => {
                const rows  = allData.filter(d => d.consultant === c.name || d.foundation === c.name || d.foundation2 === c.name);
                const done  = rows.filter(d => d.status === 'Done').length;
                return '<div class="consultant-mini-card">' +
                    '<div class="cmc-name">' + escHtml(c.name) + '</div>' +
                    '<div class="cmc-badge">' + escHtml(c.batch) + '</div>' +
                    '<div class="cmc-stats">' +
                    '<div class="cmc-stat"><div class="cmc-stat-val text-success">' + done + '</div><div class="cmc-stat-lbl">Done</div></div>' +
                    '<div class="cmc-stat"><div class="cmc-stat-val" style="color:var(--info)">' + rows.length + '</div><div class="cmc-stat-lbl">Total</div></div>' +
                    '</div></div>';
            }).join('');
        }
    }

    // Consultants page — left cards
    const cardsGrid = document.getElementById('consultantCardsGrid');
    if (cardsGrid) {
        if (!allConsultants.length) {
            cardsGrid.innerHTML = '<p style="color:var(--text-muted)">No consultants found.</p>';
        } else {
            cardsGrid.innerHTML = allConsultants.map(c => {
                const initials = c.name.split(' ').map(w => w[0]||'').join('').substring(0,2).toUpperCase();
                const done     = allData.filter(d => (d.consultant===c.name||d.foundation===c.name||d.foundation2===c.name) && d.status==='Done').length;
                return '<div class="consultant-card">' +
                    '<div class="cc-avatar">' + initials + '</div>' +
                    '<div style="flex:1"><div class="cc-name">' + escHtml(c.name) + '</div><div class="cc-batch">' + escHtml(c.batch) + '</div></div>' +
                    '<div style="text-align:right"><div style="font-size:0.8rem;color:var(--text-faint)">' + escHtml(c.phone||'—') + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--success);margin-top:2px">' + done + ' done</div></div>' +
                    '</div>';
            }).join('');
        }
    }

    // Consultants page — right stats table
    const statsBody = document.getElementById('consultantStatsBody');
    if (statsBody) {
        if (!allConsultants.length) {
            statsBody.innerHTML = '<tr><td colspan="6" class="empty-state">No data</td></tr>';
        } else {
            statsBody.innerHTML = allConsultants.map(c => {
                const rows      = allData.filter(d => d.consultant===c.name || d.foundation===c.name || d.foundation2===c.name);
                const done      = rows.filter(d => d.status==='Done').length;
                const allocated = rows.filter(d => d.status==='Allocated').length;
                const dnpRef    = rows.filter(d => ['DNP','Refund'].includes(d.status)).length;
                return '<tr>' +
                    '<td><strong>' + escHtml(c.name) + '</strong></td>' +
                    '<td><span class="badge" style="background:var(--primary-glow);color:var(--primary);border:1px solid var(--border-glow);font-size:0.7rem">' + escHtml(c.batch) + '</span></td>' +
                    '<td><span class="text-success">' + done + '</span></td>' +
                    '<td><span style="color:#818cf8">' + allocated + '</span></td>' +
                    '<td><span class="text-danger">' + dnpRef + '</span></td>' +
                    '<td><strong>' + rows.length + '</strong></td>' +
                    '</tr>';
            }).join('');
        }
    }
}

function updateConsultantFilter() {
    const sel = document.getElementById('consultantFilter');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="all">All Consultants</option>';
    allConsultants.forEach(c => { sel.innerHTML += '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + '</option>'; });
    if (prev) sel.value = prev;
}

// =====================================================================
//  MODAL — Detail & Assign
// =====================================================================
function setupModal() {
    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('saveUpdatesBtn')?.addEventListener('click', saveAssignment);
    document.getElementById('detailModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('detailModal')) closeModal();
    });
}

window.openDetailModal = function(id) {
    const item = allData.find(d => d.id === id);
    if (!item) return;
    currentEditingId = id;

    document.getElementById('modalName').textContent    = item.clientName;
    document.getElementById('modalContact').textContent = '📞 ' + (item.phone || '—') + ' · ✉️ ' + (item.email || '—');

    const campBadge = document.getElementById('modalCampaignBadge');
    campBadge.textContent = '🚩 Hanuman Jayanti';
    campBadge.className   = 'badge campaign-badge badge-hanuman';

    const sMap = { Done:'badge-done', Allocated:'badge-allocated', Pending:'badge-pending', DNP:'badge-dnp', Refund:'badge-refund', 'Allotment Changed':'badge-allotment' };
    const sBadge = document.getElementById('modalStatusBadge');
    sBadge.textContent = item.status;
    sBadge.className   = 'badge ' + (sMap[item.status] || 'badge-pending');

    document.getElementById('modalGender').textContent     = item.gender     || '—';
    document.getElementById('modalDob').textContent        = item.dob        || '—';
    document.getElementById('modalTob').textContent        = item.time       || '—';
    document.getElementById('modalPob').textContent        = item.place      || '—';
    document.getElementById('modalClientType').textContent = item.clientType
        ? (item.clientType.toLowerCase().includes('new') ? '🆕 New Client' : '🔄 Existing Client')
        : '—';
    document.getElementById('modalHeardVia').textContent   = item.heardVia   || '—';
    document.getElementById('modalConcern').textContent    = item.concern    || 'Not specified';
    document.getElementById('modalQuery').textContent      = item.queryDetail|| 'No details provided.';
    document.getElementById('modalPackage').textContent    = item.package_   || '—';
    document.getElementById('modalPayment').textContent    = item.paymentMethod || '—';

    const link = document.getElementById('modalScreenshotLink');
    if (item.screenshotUrl && item.screenshotUrl.includes('http')) {
        link.href = item.screenshotUrl; link.style.display = 'inline-block';
    } else { link.style.display = 'none'; }

    const cSel = document.getElementById('consultantSelect');
    const fSel = document.getElementById('foundationSelect');
    const aSel = document.getElementById('additionalConsultantSelect');
    cSel.innerHTML = '<option value="">— Unassigned —</option>';
    fSel.innerHTML = '<option value="">— None —</option>';
    aSel.innerHTML = '<option value="">— None —</option>';
    allConsultants.forEach(c => {
        const opt = '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + ' (' + escHtml(c.batch) + ')</option>';
        cSel.innerHTML += opt; fSel.innerHTML += opt; aSel.innerHTML += opt;
    });
    cSel.value = item.consultant || '';
    fSel.value = item.foundation || '';
    aSel.value = item.foundation2 || '';
    document.getElementById('firstPreferenceInput').value = item.firstPref || '';
    document.getElementById('statusSelect').value = item.status;

    // Feedback & Notes
    document.getElementById('clientFeedbackSelect').value = item.feedback || '';
    document.getElementById('consultationNotes').value    = item.notes    || '';

    // UI Adjustments based on role
    const feedbackSec = document.getElementById('feedbackSection');
    if (currentUser?.role === 'consultant') {
        feedbackSec.style.display = 'block';
    } else {
        feedbackSec.style.display = 'block'; // Admin can also see/edit
    }

    document.getElementById('detailModal').classList.add('active');
};

window.closeModal = function() {
    document.getElementById('detailModal').classList.remove('active');
    currentEditingId = null;
};

// =====================================================================
//  SYNC UTILITY (Updates back to GS)
// =====================================================================
async function syncToGS(data) {
    if (!SYNC_URL) return { success: false, error: 'No Sync URL' };
    try {
        const response = await fetch(SYNC_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) {
        console.error('Sync Error:', e);
        return { success: false, error: e.message };
    }
}

window.saveAssignment = async function() {
    if (!currentEditingId) return;
    const idx = allData.findIndex(d => d.id === currentEditingId);
    if (idx < 0) return;
    
    const btn = document.getElementById('saveUpdatesBtn');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Syncing...</span>';

    const payload = {
        action: 'updateAssignment',
        rowNum: allData[idx].rowNum,
        consultant: document.getElementById('consultantSelect').value,
        foundation: document.getElementById('foundationSelect').value,
        foundation2: document.getElementById('additionalConsultantSelect').value,
        firstPref:  document.getElementById('firstPreferenceInput').value,
        status:     document.getElementById('statusSelect').value,
        feedback:   document.getElementById('clientFeedbackSelect').value,
        notes:      document.getElementById('consultationNotes').value
    };

    const result = await syncToGS(payload);
    
    if (result.success || !SYNC_URL) {
        allData[idx].consultant = payload.consultant;
        allData[idx].foundation = payload.foundation;
        allData[idx].foundation2 = payload.foundation2;
        allData[idx].firstPref  = payload.firstPref;
        allData[idx].status     = payload.status;
        allData[idx].feedback   = payload.feedback;
        allData[idx].notes      = payload.notes;
        showToast(SYNC_URL ? 'Saved and Synced to Sheet' : 'Saved locally (Sync disabled)', 'success');
        updateStats(); renderMainTable(); renderRecentTable(); renderConsultantViews(); renderMyConsultations(); updateSidebarBadge();
        closeModal();
    } else {
        showToast('Sync Failed: Check Apps Script deployment', 'error');
    }
    
    btn.disabled = false;
    btn.innerHTML = oldText;
};

window.copyClientInfo = function() {
    if (!currentEditingId) return;
    const item = allData.find(d => d.id === currentEditingId);
    if (!item) return;
    const text = 'Name: ' + item.clientName + '\nPhone: ' + item.phone +
        '\nGender: ' + item.gender + '\nDOB: ' + item.dob + ' | Time: ' + item.time +
        '\nPlace: ' + item.place + '\nConcern: ' + item.concern +
        '\nPackage: ' + item.package_ + '\nQuery: ' + item.queryDetail;
    navigator.clipboard?.writeText(text).then(() => showToast('Copied!', 'success'));
};

// =====================================================================
//  ADD CONSULTANT MODAL
// =====================================================================
window.openAddConsultantModal = function() {
    document.getElementById('addConsultantModal').classList.add('active');
    document.getElementById('consultantAddStatus').textContent = '';
};

window.closeAddConsultantModal = function() {
    document.getElementById('addConsultantModal').classList.remove('active');
    ['newConsultantName','newConsultantBatch','newConsultantPhone'].forEach(id => {
        document.getElementById(id).value = '';
    });
};

document.getElementById('addConsultantModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('addConsultantModal')) closeAddConsultantModal();
});

window.saveNewConsultant = async function() {
    const name  = document.getElementById('newConsultantName').value.trim();
    const batch = document.getElementById('newConsultantBatch').value.trim();
    const phone = document.getElementById('newConsultantPhone').value.trim();
    const statusEl = document.getElementById('consultantAddStatus');
    
    if (!name) { statusEl.textContent = 'Please enter a name.'; statusEl.style.color = 'var(--danger)'; return; }

    statusEl.textContent = 'Syncing to Sheet...';
    statusEl.style.color = 'var(--info)';

    const result = await syncToGS({
        action: 'addConsultant',
        name, batch: batch || 'General', phone
    });

    if (result.success || !SYNC_URL) {
        allConsultants.push({ name, batch: batch||'General', phone });
        renderConsultantViews(); updateConsultantFilter();
        showToast(name + ' added to Sheet', 'success');
        statusEl.textContent  = SYNC_URL ? 'Added to Google Sheet!' : 'Added locally (Sync disabled)';
        statusEl.style.color  = 'var(--success)';
        setTimeout(closeAddConsultantModal, 1800);
    } else {
        statusEl.textContent = 'Failed to sync. Check SYNC_URL.';
        statusEl.style.color = 'var(--danger)';
    }
};

// =====================================================================
//  UTILITIES
// =====================================================================
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className   = 'toast show ' + (type||'info');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
// =====================================================================
//  MOBILE MENU
// =====================================================================
function setupMobileMenu() {
    const toggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!toggle || !sidebar || !overlay) return;
    
    const toggleMenu = () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
        // Prevent body scroll when menu open
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    };
    
    toggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    
    // Close on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 900) {
                toggleMenu();
            }
        });
    });
}
