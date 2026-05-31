const SUPABASE_URL = 'https://rhfmgkhkarbwlqmutrle.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KcrZXeKIIMWHrHxj2_RHg_es2sYhsf';

// Suppress EventEmitter warnings globally
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(0);
}

// Override console.warn to suppress specific warnings
const originalWarn = console.warn;
console.warn = function(...args) {
  const message = String(args[0] || '');
  if (message.includes('MaxListenersExceeded') || message.includes('ObjectMultiplex')) {
    return; // Suppress these warnings silently
  }
  originalWarn.apply(console, args);
};

// Also suppress at the window level
window.addEventListener('error', (e) => {
  const msg = String(e.message || '');
  if (msg.includes('MaxListenersExceeded') || msg.includes('ObjectMultiplex')) {
    e.preventDefault();
  }
}, true);

const stats = {
  totalLogs: 0,
  totalHumans: 0,
  lastUpdate: '--',
};

const state = {
  expandedRow: null,
};

const elements = {
  totalLogs: document.querySelector('[data-total-logs]'),
  totalHumans: document.querySelector('[data-total-humans]'),
  lastUpdate: document.querySelector('[data-last-update]'),
  logBody: document.querySelector('#log-body'),
  loading: document.querySelector('#loading-overlay'),
  refreshButton: document.querySelector('#refresh-button'),
  statusMessage: document.querySelector('#status-message'),
};

async function fetchLogs() {
  showLoading(true);
  clearStatus();

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/logs`);
    url.searchParams.set('select', 'time_stamp,name,humans,machines,description');
    url.searchParams.set('order', 'time_stamp.desc');
    url.searchParams.set('limit', '30');

    const response = await fetch(url.toString(), {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Supabase REST response:', { status: response.status, data });

    renderLogs(Array.isArray(data) ? data : []);
    updateStats(Array.isArray(data) ? data : []);

    if (!Array.isArray(data) || data.length === 0) {
      setStatus('Fetched 0 rows. Confirm Supabase table policies allow anon select access for `logs`.');
    } else {
      setStatus(`Fetched ${data.length} rows from logs.`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    const message = error?.message || 'Unable to retrieve logs. Check Supabase keys and network access.';
    setStatus(message);
    renderLogs([]);
  } finally {
    showLoading(false);
  }
}

function showLoading(isLoading) {
  elements.loading.style.display = isLoading ? 'grid' : 'none';
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function clearStatus() {
  elements.statusMessage.textContent = '';
}

function updateStats(logs) {
  stats.totalLogs = logs.length;
  stats.totalHumans = logs.reduce((sum, entry) => sum + (Number(entry.humans) || 0), 0);
  const latest = logs[0]?.time_stamp;
  stats.lastUpdate = latest ? new Date(latest).toLocaleString() : '--';

  elements.totalLogs.textContent = stats.totalLogs;
  elements.totalHumans.textContent = stats.totalHumans;
  elements.lastUpdate.textContent = stats.lastUpdate;
}

function buildMachinesContent(machines) {
  if (!machines || machines.length === 0) {
    return '<div class="machines-empty">No machine data recorded.</div>';
  }

  const rows = machines
    .map((item) => `
      <tr>
        <td>${escapeText(item.name || 'unknown')}</td>
        <td class="machine-qty">${item.quantity ?? 0}</td>
      </tr>
    `)
    .join('');

  return `
    <table class="machines-table">
      <thead>
        <tr>
          <th>Machine Name</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderLogs(logs) {
  elements.logBody.innerHTML = '';

  logs.forEach((log, index) => {
    const rowId = `row-${index}`;
    const expanded = state.expandedRow === rowId;

    const row = document.createElement('tr');
    row.className = `log-row${expanded ? ' expanded' : ''}`;
    row.dataset.rowId = rowId;
    row.dataset.rowIndex = index;
    row.innerHTML = `
      <td><span class="time-cell">${formatDate(log.time_stamp)}</span></td>
      <td><span class="name-cell">${escapeText(log.name)}</span></td>
      <td><span class="humans-cell">${escapeText(log.humans)}</span></td>
      <td><span class="tag">${Array.isArray(log.machines) ? log.machines.length : 0}</span></td>
      <td><span class="desc-cell">${escapeText(log.description)}</span></td>
    `;

    const expandRow = document.createElement('tr');
    expandRow.className = 'log-row-expand';
    expandRow.innerHTML = `
      <td colspan="5">
        <div class="expand-panel">
          <div class="expand-header">Machine Details</div>
          ${buildMachinesContent(log.machines || [])}
        </div>
      </td>
    `;

    elements.logBody.appendChild(row);
    elements.logBody.appendChild(expandRow);
  });
}

function toggleExpand(rowId, index) {
  const previous = document.querySelector('.log-row.expanded');
  if (previous) {
    previous.classList.remove('expanded');
  }

  if (state.expandedRow === rowId) {
    state.expandedRow = null;
  } else {
    state.expandedRow = rowId;
    const current = document.querySelectorAll('.log-row')[index];
    if (current) current.classList.add('expanded');
  }
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  return isNaN(date.getTime()) ? escapeText(String(value)) : date.toLocaleString();
}

function escapeText(value) {
  if (value === null || value === undefined) return '--';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/\'/g, '&#039;');
}

function wireEvents() {
  elements.refreshButton.addEventListener('click', fetchLogs);
  
  // Event delegation for row expansion
  elements.logBody.addEventListener('click', (event) => {
    const row = event.target.closest('.log-row');
    if (row) {
      const rowId = row.dataset.rowId;
      const rowIndex = parseInt(row.dataset.rowIndex, 10);
      toggleExpand(rowId, rowIndex);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  if (!elements.refreshButton || !elements.logBody) {
    console.error('Required DOM elements are missing.');
    setStatus('Unable to initialize dashboard UI.');
    return;
  }
  wireEvents();
  fetchLogs();
});
