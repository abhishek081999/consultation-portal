// =====================================================================
// JYOTISH ADMIN PORTAL - script.js
// Data Source: data.js (generated from XLSX by generate-data.js)
// Run `node generate-data.js` to refresh data from the Excel file.
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

// =====================================================================
//  INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupFilters();
    setupSearch();
    setupModal();
    loadXLSXData();
    document.getElementById('refreshBtn').addEventListener('click', () => {
        document.getElementById('refreshBtn').classList.add('spinning');
        loadXLSXData();
        setTimeout(() => document.getElementById('refreshBtn').classList.remove('spinning'), 800);
    });
});

// =====================================================================
//  NAVIGATION
// =====================================================================
function setupNavigation() {
    const pageTitles = { dashboard: 'Dashboard', requests: 'Consult Requests', consultants: 'Consultants' };

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
    };
}

// =====================================================================
//  LOAD FROM data.js  (XLSX_DATA global)
// =====================================================================
function loadXLSXData() {
    if (typeof XLSX_DATA === 'undefined') {
        showToast('data.js not found — run: node generate-data.js', 'error');
        document.getElementById('connectionStatus').classList.add('offline');
        document.getElementById('connectionStatus').title = 'data.js missing';
        return;
    }

    // Responses — data.js already has clean pre-mapped fields
    allData = (XLSX_DATA.responses || []).map(r => ({
        id:            r.id          || '',
        rowNum:        r.rowNum      || '',
        campaign:      r.Campaign    || r.campaign || 'General',
        clientName:    r.clientName  || '',
        phone:         String(r.phone || '').trim(),
        gender:        r.gender      || '',
        dob:           r.dob         || '',
        time:          r.time        || '',
        place:         r.place       || '',
        package_:      r.package     || '',
        concern:       r.concern     || '',
        queryDetail:   r.queryDetail || '',
        consultant:    r.consultant  || '',
        foundation:    r.foundation  || '',
        firstPref:     r.firstPref   || '',
        status:        r.status      || 'Pending',
        email:         r.email       || '',
        clientType:    r.clientType  || '',
        heardVia:      r.heardVia    || '',
        paymentMethod: r.payment     || '',
        screenshotUrl: r.screenshot  || '',
    })).filter(r => r.clientName);

    // Consultants
    allConsultants = (XLSX_DATA.consultants || [])
        .map(c => ({ name: c.name || '', batch: c.batch || 'General', phone: c.phone || '' }))
        .filter(c => c.name);

    document.getElementById('connectionStatus').classList.remove('offline');
    document.getElementById('connectionStatus').title = `XLSX loaded — ${allData.length} records`;

    refreshAll();
    showToast('Loaded ' + allData.length + ' records from XLSX', 'success');
}

// =====================================================================
//  REFRESH
// =====================================================================
function refreshAll() {
    updateStats();
    renderRecentTable();
    renderMainTable();
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
    const makar   = data.filter(d => d.campaign === 'Makar Sankranti').length;
    const hanuman = data.filter(d => d.campaign === 'Hanuman Jayanti').length;

    document.getElementById('totalRequests').textContent     = total;
    document.getElementById('completedRequests').textContent = done;
    document.getElementById('pendingAssignments').textContent = pending;
    document.getElementById('dnpCount').textContent          = dnp;
    document.getElementById('statCampaignBreak').textContent = 'Makar: ' + makar + ' · Hanuman: ' + hanuman;
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
        if (currentConsultantFilter !== 'all' && item.consultant !== currentConsultantFilter) return false;
        if (currentGenderFilter !== 'all' && item.gender.toLowerCase() !== currentGenderFilter.toLowerCase()) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const hay = [item.clientName, item.phone, item.email, item.concern, item.place, item.consultant].join(' ').toLowerCase();
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
    const isMakar = campaign.includes('Makar');
    const cls   = isMakar ? 'badge-makar' : campaign.includes('Hanuman') ? 'badge-hanuman' : 'badge-general';
    const label = isMakar ? 'Makar'       : campaign.includes('Hanuman') ? 'Hanuman'       : 'General';
    return '<span class="badge campaign-badge ' + cls + '">' + label + '</span>';
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
        '<td>' + (row.consultant ? '<span style="color:var(--primary)">' + escHtml(row.consultant) + '</span>' : '<em style="color:var(--text-faint)">Unassigned</em>') + '</td>' +
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
                 (row.foundation  ? '<div style="font-size:0.72rem;color:var(--text-faint)">+ ' + escHtml(row.foundation) + '</div>' : '') + '</td>' +
        '<td><button class="action-btn" onclick="openDetailModal(\'' + escHtml(row.id) + '\')">View &amp; Assign</button></td>' +
        '</tr>'
    ).join('');
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
                const rows  = allData.filter(d => d.consultant === c.name || d.foundation === c.name);
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
                const done     = allData.filter(d => (d.consultant===c.name||d.foundation===c.name) && d.status==='Done').length;
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
                const rows      = allData.filter(d => d.consultant===c.name || d.foundation===c.name);
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
    campBadge.textContent = item.campaign.includes('Makar') ? '🪁 Makar Sankranti' : '🚩 Hanuman Jayanti';
    campBadge.className   = 'badge campaign-badge ' + (item.campaign.includes('Makar') ? 'badge-makar' : 'badge-hanuman');

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
    cSel.innerHTML = '<option value="">— Unassigned —</option>';
    fSel.innerHTML = '<option value="">— None —</option>';
    allConsultants.forEach(c => {
        const opt = '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + ' (' + escHtml(c.batch) + ')</option>';
        cSel.innerHTML += opt; fSel.innerHTML += opt;
    });
    cSel.value = item.consultant || '';
    fSel.value = item.foundation || '';
    document.getElementById('firstPreferenceInput').value = item.firstPref || '';
    document.getElementById('statusSelect').value = item.status;

    document.getElementById('detailModal').classList.add('active');
};

window.closeModal = function() {
    document.getElementById('detailModal').classList.remove('active');
    currentEditingId = null;
};

window.saveAssignment = function() {
    if (!currentEditingId) return;
    const idx = allData.findIndex(d => d.id === currentEditingId);
    if (idx < 0) return;
    allData[idx].consultant = document.getElementById('consultantSelect').value;
    allData[idx].foundation = document.getElementById('foundationSelect').value;
    allData[idx].firstPref  = document.getElementById('firstPreferenceInput').value;
    allData[idx].status     = document.getElementById('statusSelect').value;
    showToast('Saved for ' + allData[idx].clientName, 'success');
    updateStats(); renderMainTable(); renderRecentTable(); renderConsultantViews(); updateSidebarBadge();
    closeModal();
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

window.saveNewConsultant = function() {
    const name  = document.getElementById('newConsultantName').value.trim();
    const batch = document.getElementById('newConsultantBatch').value.trim();
    const phone = document.getElementById('newConsultantPhone').value.trim();
    const statusEl = document.getElementById('consultantAddStatus');
    if (!name) { statusEl.textContent = 'Please enter a name.'; statusEl.style.color = 'var(--danger)'; return; }
    allConsultants.push({ name, batch: batch||'General', phone });
    renderConsultantViews(); updateConsultantFilter();
    showToast(name + ' added', 'success');
    statusEl.textContent  = 'Added! (To persist: add to XLSX and re-run generate-data.js)';
    statusEl.style.color  = 'var(--success)';
    setTimeout(closeAddConsultantModal, 1800);
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
