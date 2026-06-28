/* ============================================================
   EchoDB — script.js
   Modular JavaScript: API layer → State → UI renderers
   ============================================================ */

'use strict';

/* ─── CONFIG ────────────────────────────────────────────────── */
const CONFIG = {
  gateway: 'http://127.0.0.1:8000',
  healthInterval:  8000,   // ms between automatic health polls
  maxLogEntries:   120,    // keep log feed lean
  pageSize:        10,     // rows per page
};

/* ─── STATE ─────────────────────────────────────────────────── */
const state = {
  users:        [],        // raw list from API
  filtered:     [],        // after search filter
  sortCol:      null,
  sortDir:      'asc',     // 'asc' | 'desc'
  page:         1,
  searchQuery:  '',
  healthData:   null,
  healthCountdown: 0,
};


/* ═══════════════════════════════════════════════════════════════
   API LAYER — all backend communication lives here
═══════════════════════════════════════════════════════════════ */

const api = {
  url(path) {
    return `${CONFIG.gateway}${path}`;
  },

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(api.url(path), opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.detail || data.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  getUsers()             { return api.request('GET',    '/users'); },
  createUser(payload)    { return api.request('POST',   '/users', payload); },
  updateUser(id, payload){ return api.request('PUT',    `/users/${id}`, payload); },
  deleteUser(id)         { return api.request('DELETE', `/users/${id}`); },
  getHealth()            { return api.request('GET',    '/health'); },
};


/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */

function showToast(type, title, msg = '') {
  const container = document.getElementById('toast-container');

  const icons = { success: '✓', error: '✕', info: 'i' };

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'i'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">✕</button>
  `;

  el.querySelector('.toast-close').addEventListener('click', () => removeToast(el));
  container.prepend(el);

  setTimeout(() => removeToast(el), 4500);
}

function removeToast(el) {
  if (!el.parentNode) return;
  el.classList.add('toast--removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}


/* ═══════════════════════════════════════════════════════════════
   LOG FEED
═══════════════════════════════════════════════════════════════ */

function appendLog(message, type = 'info') {
  const feed = document.getElementById('log-feed');

  // remove empty placeholder
  const empty = feed.querySelector('.log-empty');
  if (empty) empty.remove();

  const now = new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-dot log-dot--${type}"></span>
    <span class="log-msg">${message}</span>
  `;

  feed.prepend(entry);

  // trim old entries
  const entries = feed.querySelectorAll('.log-entry');
  if (entries.length > CONFIG.maxLogEntries) {
    entries[entries.length - 1].remove();
  }
}

function clearLog() {
  const feed = document.getElementById('log-feed');
  feed.innerHTML = '<p class="log-empty">Log cleared.</p>';
}

function pad(n) { return String(n).padStart(2, '0'); }


/* ═══════════════════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════════════════ */

function startClock() {
  const el = document.getElementById('current-time');
  function tick() {
    const now = new Date();
    el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  tick();
  setInterval(tick, 1000);
}


/* ═══════════════════════════════════════════════════════════════
   HEALTH — status cards + sidebar panel
═══════════════════════════════════════════════════════════════ */

function updateStatusCard(cardId, pillId, pillLabel, extraId, extraValue) {
  const pill = document.getElementById(pillId);
  const prev = pill.textContent.trim();

  pill.textContent = pillLabel;
  pill.className   = 'status-pill';

  const lower = pillLabel.toLowerCase();
  if (lower === 'healthy' || lower === 'online') pill.classList.add('status-pill--healthy');
  else if (lower === 'offline' || lower === 'down') pill.classList.add('status-pill--offline');
  else pill.classList.add('status-pill--checking');

  // animate value change
  const valEl = document.getElementById(extraId);
  if (valEl) {
    if (valEl.textContent !== String(extraValue)) {
      valEl.textContent = extraValue ?? '—';
      valEl.classList.remove('value-changed');
      void valEl.offsetWidth; // reflow
      valEl.classList.add('value-changed');
    }
  }
}

function renderHealthPanel(data) {
  if (!data) return;

  const nodes = data.nodes || {};
  const gw    = data.gateway_status || 'unknown';

  // Sidebar health items
  function setSidebarItem(hpId, dotEl, label) {
    const el  = document.getElementById(hpId);
    const dot = el?.previousElementSibling;
    if (!el) return;
    const up = label === 'Healthy' || label === 'Online';
    el.textContent = label;
    el.className   = `health-state ${up ? 'health-state--healthy' : 'health-state--offline'}`;
    if (dot) {
      dot.className = `health-dot ${up ? 'health-dot--healthy' : 'health-dot--offline'}`;
    }
  }

  const gwUp = gw === 'online' || gw === 'healthy';
  setSidebarItem('hp-gateway', null, gwUp ? 'Online' : 'Offline');

  ['node1', 'node2', 'node3'].forEach((n, i) => {
    const key   = Object.keys(nodes)[i] || n;
    const nData = nodes[key] || {};
    const up    = nData.status === 'healthy' || nData.status === 'online';
    setSidebarItem(`hp-${n}`, null, up ? 'Healthy' : 'Offline');
  });

  // Status cards
  const gwBadgeDot  = document.getElementById('gateway-dot');
  const gwStatusTxt = document.getElementById('gateway-status-text');

  if (gwUp) {
    gwBadgeDot.className  = 'badge-dot badge-dot--online';
    gwStatusTxt.textContent = 'Online';
  } else {
    gwBadgeDot.className  = 'badge-dot badge-dot--offline';
    gwStatusTxt.textContent = 'Offline';
  }

  updateStatusCard('card-gateway', 'gateway-pill', gwUp ? 'Online' : 'Offline',
    'gateway-active-node', data.active_node ?? '—');

  const nodeKeys = Object.keys(nodes);
  ['node1', 'node2', 'node3'].forEach((n, i) => {
    const key   = nodeKeys[i] || n;
    const nData = nodes[key] || {};
    const up    = nData.status === 'healthy' || nData.status === 'online';
    const label = up ? 'Healthy' : 'Offline';
    updateStatusCard(`card-${n}`, `${n}-pill`, label,
      `${n}-users`, nData.user_count ?? nData.users ?? '—');
  });
}

async function fetchHealth(silent = false) {
  appendLog('Polling system health…', 'info');
  try {
    const data = await api.getHealth();
    state.healthData = data;
    renderHealthPanel(data);
    if (!silent) appendLog('Health check completed', 'success');
  } catch (err) {
    appendLog(`Health check failed: ${err.message}`, 'error');
    // mark everything offline
    ['gateway-dot'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'badge-dot badge-dot--offline';
    });
    document.getElementById('gateway-status-text').textContent = 'Offline';
    ['gateway-pill','node1-pill','node2-pill','node3-pill'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = 'Offline'; el.className = 'status-pill status-pill--offline'; }
    });
    ['hp-gateway','hp-node1','hp-node2','hp-node3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = 'Offline'; el.className = 'health-state health-state--offline'; }
    });
  }
}

function startHealthPolling() {
  fetchHealth(true);
  let cd = Math.round(CONFIG.healthInterval / 1000);
  const cdEl = document.getElementById('health-countdown');

  setInterval(() => {
    cd--;
    cdEl.textContent = `refresh in ${cd}s`;
    if (cd <= 0) {
      cd = Math.round(CONFIG.healthInterval / 1000);
      fetchHealth(true);
    }
  }, 1000);
}


/* ═══════════════════════════════════════════════════════════════
   USERS — fetch, render, search, sort, paginate
═══════════════════════════════════════════════════════════════ */

async function loadUsers() {
  const tbody      = document.getElementById('user-tbody');
  const loadingEl  = document.getElementById('table-loading');
  const emptyEl    = document.getElementById('table-empty');
  const footerEl   = document.getElementById('table-footer');

  tbody.innerHTML = '';
  loadingEl.removeAttribute('hidden');
  emptyEl.setAttribute('hidden', '');
  footerEl.setAttribute('hidden', '');

  appendLog('Gateway received request: GET /users', 'info');

  try {
    const data = await api.getUsers();
    state.users = Array.isArray(data) ? data : (data.users || []);
    appendLog(`Fetched ${state.users.length} user(s) from database`, 'success');
    applyFilterAndSort();
    footerEl.removeAttribute('hidden');
  } catch (err) {
    appendLog(`Error fetching users: ${err.message}`, 'error');
    showToast('error', 'Failed to load users', err.message);
    emptyEl.removeAttribute('hidden');
  } finally {
    loadingEl.setAttribute('hidden', '');
  }
}

function applyFilterAndSort() {
  const q = state.searchQuery.toLowerCase();

  // filter
  let result = state.users.filter(u => {
    if (!q) return true;
    return (
      String(u.id).includes(q) ||
      (u.name  || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.city  || '').toLowerCase().includes(q) ||
      String(u.age || '').includes(q)
    );
  });

  // sort
  if (state.sortCol) {
    result = result.slice().sort((a, b) => {
      let va = a[state.sortCol] ?? '';
      let vb = b[state.sortCol] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return state.sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  state.filtered = result;
  state.page = 1;
  renderTable();
}

function renderTable() {
  const tbody   = document.getElementById('user-tbody');
  const emptyEl = document.getElementById('table-empty');
  const rowCount = document.getElementById('row-count');

  tbody.innerHTML = '';

  if (state.filtered.length === 0) {
    emptyEl.removeAttribute('hidden');
    rowCount.textContent = '';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  emptyEl.setAttribute('hidden', '');

  const total  = state.filtered.length;
  const pages  = Math.ceil(total / CONFIG.pageSize);
  const start  = (state.page - 1) * CONFIG.pageSize;
  const end    = Math.min(start + CONFIG.pageSize, total);
  const slice  = state.filtered.slice(start, end);

  rowCount.textContent = `Showing ${start + 1}–${end} of ${total} user${total !== 1 ? 's' : ''}`;

  slice.forEach((user, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${i * 0.03}s`;
    tr.innerHTML = `
      <td class="td-id">${user.id ?? '—'}</td>
      <td>${esc(user.name  || '—')}</td>
      <td>${esc(user.email || '—')}</td>
      <td>${esc(user.city  || '—')}</td>
      <td>${user.age ?? '—'}</td>
      <td>${user.served_by ? `<span class="node-badge">${esc(user.served_by)}</span>` : '—'}</td>
      <td>
        <div class="action-group">
          <button class="btn-action btn-action--view"   title="View"   data-id="${user.id}" data-action="view">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="6.5" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
          </button>
          <button class="btn-action btn-action--edit"   title="Edit"   data-id="${user.id}" data-action="edit">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2.5l1.5 1.5L4 10.5H2.5V9L9 2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn-action btn-action--delete" title="Delete" data-id="${user.id}" data-action="delete">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 6v3.5M7.5 6v3.5M3 3.5l.5 7h6l.5-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(pages);
}

function renderPagination(pages) {
  const pg = document.getElementById('pagination');
  pg.innerHTML = '';
  if (pages <= 1) return;

  const mkBtn = (label, page, active) => {
    const btn = document.createElement('button');
    btn.className = `page-btn${active ? ' page-btn--active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => { state.page = page; renderTable(); });
    return btn;
  };

  if (state.page > 1) pg.appendChild(mkBtn('←', state.page - 1, false));

  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== pages) {
      if (i === state.page - 3 || i === state.page + 3) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'padding:0 4px;color:var(--text-muted);font-size:0.8rem;';
        pg.appendChild(dots);
      }
      continue;
    }
    pg.appendChild(mkBtn(i, i, i === state.page));
  }

  if (state.page < pages) pg.appendChild(mkBtn('→', state.page + 1, false));
}

function setupSortHeaders() {
  document.querySelectorAll('.user-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      // reset all arrows
      document.querySelectorAll('.sort-arrow').forEach(a => {
        a.textContent = '↕'; a.className = 'sort-arrow';
      });
      const arrow = th.querySelector('.sort-arrow');
      arrow.textContent = state.sortDir === 'asc' ? '↑' : '↓';
      arrow.className   = `sort-arrow sort-arrow--${state.sortDir}`;
      applyFilterAndSort();
    });
  });
}


/* ═══════════════════════════════════════════════════════════════
   CREATE USER FORM
═══════════════════════════════════════════════════════════════ */

function validateCreateForm() {
  const fields = [
    { id: 'f-name',  errId: 'err-name',  label: 'Name',  check: v => v.trim().length >= 2 },
    { id: 'f-email', errId: 'err-email', label: 'Email', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
    { id: 'f-city',  errId: 'err-city',  label: 'City',  check: v => v.trim().length >= 2 },
    { id: 'f-age',   errId: 'err-age',   label: 'Age',   check: v => v !== '' && Number(v) >= 1 && Number(v) <= 120 },
  ];

  let valid = true;
  fields.forEach(f => {
    const inp  = document.getElementById(f.id);
    const errEl = document.getElementById(f.errId);
    const val  = inp.value;
    if (!f.check(val)) {
      inp.classList.add('has-error');
      errEl.textContent = `${f.label} is required and must be valid.`;
      valid = false;
    } else {
      inp.classList.remove('has-error');
      errEl.textContent = '';
    }
  });
  return valid;
}

function resetCreateForm() {
  ['f-name','f-email','f-city','f-age'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('has-error');
  });
  ['err-name','err-email','err-city','err-age'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
}

async function handleCreateUser() {
  if (!validateCreateForm()) return;

  const btn     = document.getElementById('create-user-btn');
  const spinner = document.getElementById('create-spinner');
  const btnText = btn.querySelector('.btn-text');

  btn.disabled       = true;
  spinner.removeAttribute('hidden');
  btnText.textContent = 'Creating…';

  const payload = {
    name:  document.getElementById('f-name').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    city:  document.getElementById('f-city').value.trim(),
    age:   Number(document.getElementById('f-age').value),
  };

  appendLog('Gateway received request: POST /users', 'info');
  appendLog(`Routing to primary node…`, 'info');

  try {
    const user = await api.createUser(payload);
    const node = user.served_by || 'Node';
    appendLog(`Request routed to ${node}`, 'info');
    appendLog(`Replication started`, 'info');
    appendLog(`Replicated to remaining nodes`, 'success');
    appendLog(`Request completed — user #${user.id} created`, 'success');
    showToast('success', 'User created', `${payload.name} was added successfully.`);
    resetCreateForm();
    await loadUsers();
  } catch (err) {
    appendLog(`Create user failed: ${err.message}`, 'error');
    showToast('error', 'Failed to create user', err.message);
  } finally {
    btn.disabled        = false;
    spinner.setAttribute('hidden', '');
    btnText.textContent  = 'Create User';
  }
}


/* ═══════════════════════════════════════════════════════════════
   TABLE ACTIONS — view / edit / delete
═══════════════════════════════════════════════════════════════ */

document.getElementById('user-tbody').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id     = Number(btn.dataset.id);
  const action = btn.dataset.action;
  const user   = state.users.find(u => u.id === id);
  if (!user) return;

  if (action === 'view')   openViewModal(user);
  if (action === 'edit')   openEditModal(user);
  if (action === 'delete') handleDeleteUser(user);
});

/* View Modal */
function openViewModal(user) {
  const modal = document.getElementById('view-modal');
  const body  = document.getElementById('view-modal-body');

  const rows = [
    { label: 'ID',       value: user.id },
    { label: 'Name',     value: user.name },
    { label: 'Email',    value: user.email },
    { label: 'City',     value: user.city },
    { label: 'Age',      value: user.age },
    { label: 'Served By',value: user.served_by || '—' },
  ];

  body.innerHTML = rows.map(r => `
    <div class="detail-row">
      <span class="detail-row-label">${r.label}</span>
      <span class="detail-row-value">${esc(String(r.value ?? '—'))}</span>
    </div>
  `).join('');

  modal.removeAttribute('hidden');
}

document.getElementById('view-modal-close-btn').addEventListener('click', () => {
  document.getElementById('view-modal').setAttribute('hidden', '');
});

/* Edit Modal */
function openEditModal(user) {
  document.getElementById('edit-id').value    = user.id;
  document.getElementById('edit-name').value  = user.name  || '';
  document.getElementById('edit-email').value = user.email || '';
  document.getElementById('edit-city').value  = user.city  || '';
  document.getElementById('edit-age').value   = user.age   || '';

  ['edit-err-name','edit-err-email','edit-err-city','edit-err-age'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['edit-name','edit-email','edit-city','edit-age'].forEach(id => {
    document.getElementById(id).classList.remove('has-error');
  });

  document.getElementById('edit-modal').removeAttribute('hidden');
}

function validateEditForm() {
  const fields = [
    { id: 'edit-name',  errId: 'edit-err-name',  label: 'Name',  check: v => v.trim().length >= 2 },
    { id: 'edit-email', errId: 'edit-err-email', label: 'Email', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
    { id: 'edit-city',  errId: 'edit-err-city',  label: 'City',  check: v => v.trim().length >= 2 },
    { id: 'edit-age',   errId: 'edit-err-age',   label: 'Age',   check: v => v !== '' && Number(v) >= 1 && Number(v) <= 120 },
  ];
  let valid = true;
  fields.forEach(f => {
    const inp   = document.getElementById(f.id);
    const errEl = document.getElementById(f.errId);
    if (!f.check(inp.value)) {
      inp.classList.add('has-error');
      errEl.textContent = `${f.label} is required and must be valid.`;
      valid = false;
    } else {
      inp.classList.remove('has-error');
      errEl.textContent = '';
    }
  });
  return valid;
}

async function handleSaveEdit() {
  if (!validateEditForm()) return;

  const btn     = document.getElementById('modal-save-btn');
  const spinner = document.getElementById('edit-spinner');
  const btnText = btn.querySelector('.btn-text');

  btn.disabled       = true;
  spinner.removeAttribute('hidden');
  btnText.textContent = 'Saving…';

  const id      = Number(document.getElementById('edit-id').value);
  const payload = {
    name:  document.getElementById('edit-name').value.trim(),
    email: document.getElementById('edit-email').value.trim(),
    city:  document.getElementById('edit-city').value.trim(),
    age:   Number(document.getElementById('edit-age').value),
  };

  appendLog(`Gateway received request: PUT /users/${id}`, 'info');

  try {
    await api.updateUser(id, payload);
    appendLog(`User #${id} updated, replication propagated`, 'success');
    showToast('success', 'User updated', `${payload.name} saved successfully.`);
    document.getElementById('edit-modal').setAttribute('hidden', '');
    await loadUsers();
  } catch (err) {
    appendLog(`Update failed: ${err.message}`, 'error');
    showToast('error', 'Failed to update user', err.message);
  } finally {
    btn.disabled        = false;
    spinner.setAttribute('hidden', '');
    btnText.textContent  = 'Save Changes';
  }
}

document.getElementById('modal-save-btn').addEventListener('click',   handleSaveEdit);
document.getElementById('modal-cancel-btn').addEventListener('click', () => document.getElementById('edit-modal').setAttribute('hidden', ''));
document.getElementById('modal-close-btn').addEventListener('click',  () => document.getElementById('edit-modal').setAttribute('hidden', ''));

/* Delete */
async function handleDeleteUser(user) {
  if (!confirm(`Delete "${user.name}" (ID ${user.id})? This cannot be undone.`)) return;

  appendLog(`Gateway received request: DELETE /users/${user.id}`, 'warn');

  try {
    await api.deleteUser(user.id);
    appendLog(`User #${user.id} deleted from all nodes`, 'success');
    showToast('success', 'User deleted', `${user.name} has been removed.`);
    await loadUsers();
  } catch (err) {
    appendLog(`Delete failed: ${err.message}`, 'error');
    showToast('error', 'Failed to delete user', err.message);
  }
}

/* Close modals on backdrop click */
document.addEventListener('click', e => {
  if (e.target.id === 'edit-modal') document.getElementById('edit-modal').setAttribute('hidden', '');
  if (e.target.id === 'view-modal') document.getElementById('view-modal').setAttribute('hidden', '');
});


/* ═══════════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════════ */

function setupSearch() {
  const input = document.getElementById('search-input');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.searchQuery = input.value;
      applyFilterAndSort();
    }, 220);
  });
}


/* ═══════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════ */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ═══════════════════════════════════════════════════════════════
   INIT — wire up all event listeners and kick off data loading
═══════════════════════════════════════════════════════════════ */

function init() {
  startClock();
  setupSearch();
  setupSortHeaders();
  startHealthPolling();
  loadUsers();

  // Create user
  document.getElementById('create-user-btn').addEventListener('click', handleCreateUser);
  document.getElementById('reset-form-btn').addEventListener('click', resetCreateForm);

  // Refresh buttons
  document.getElementById('refresh-health-btn').addEventListener('click', () => fetchHealth(false));
  document.getElementById('refresh-users-btn').addEventListener('click', loadUsers);

  // Clear log
  document.getElementById('clear-log-btn').addEventListener('click', clearLog);

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('edit-modal').setAttribute('hidden', '');
      document.getElementById('view-modal').setAttribute('hidden', '');
    }
  });

  appendLog('EchoDB dashboard initialized', 'success');
}

document.addEventListener('DOMContentLoaded', init);
