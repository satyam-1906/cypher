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

// ============ PARTICLE ANIMATION SYSTEM ============
class ParticleSystem {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    
    // Create a style element for all particle animations
    this.styleElement = document.createElement('style');
    document.head.appendChild(this.styleElement);
    
    this.particles = [];
    this.maxParticles = 60;
    this.animationDurations = [];
    this.init();
  }

  init() {
    // Create all particle keyframe animations with unique, staggered durations
    let keyframes = '';
    for (let i = 0; i < this.maxParticles; i++) {
      // Create longer, more varied durations to avoid synchronized resets
      const duration = 12 + (i * 0.5) + Math.random() * 6;
      const delay = -(Math.random() * duration); // Negative delay starts animation at random point
      const xOffset = (Math.random() - 0.5) * 400;
      const yOffset = -250 - Math.random() * 350;
      
      this.animationDurations.push(duration);
      
      keyframes += `
        @keyframes particle-${i} {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0;
          }
          2% {
            opacity: 0.6;
          }
          98% {
            opacity: 0.15;
          }
          100% {
            transform: translate(${xOffset}px, ${yOffset}px) scale(0.2);
            opacity: 0;
          }
        }
      `;
      this.createParticle(i, duration, delay);
    }
    this.styleElement.textContent = keyframes;
  }

  createParticle(index, duration, delay) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const size = Math.random() * 6 + 2;
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    // Use linear timing for smooth, predictable motion
    particle.style.animation = `particle-${index} ${duration}s linear ${delay}s infinite`;
    
    this.container.appendChild(particle);
    this.particles.push(particle);
  }
}

// Initialize particle system on DOM ready
let particleSystem;

const stats = {
  totalLogs: 0,
  totalHumans: 0,
  lastUpdate: '--',
};

// Filter state
const filters = {
  search: '',
  minHumans: 0,
  maxHumans: 100,
  minMachines: 0,
  maxMachines: 20,
  dateFrom: '',
  dateTo: '',
  machineName: '',
};

const state = {
  expandedRow: null,
};

let allLogs = [];

const elements = {
  totalLogs: document.querySelector('[data-total-logs]'),
  totalHumans: document.querySelector('[data-total-humans]'),
  lastUpdate: document.querySelector('[data-last-update]'),
  logBody: document.querySelector('#log-body'),
  loading: document.querySelector('#loading-overlay'),
  refreshButton: document.querySelector('#refresh-button'),
  statusMessage: document.querySelector('#status-message'),
  // Search and Filter elements
  searchInput: document.querySelector('#search-input'),
  clearSearchBtn: document.querySelector('#clear-search-btn'),
  filterToggleBtn: document.querySelector('#filter-toggle-btn'),
  filterPanel: document.querySelector('#filter-panel'),
  filterCount: document.querySelector('#filter-count'),
  // Individual filter inputs
  humansFilter: document.querySelector('#humans-filter'),
  machinesFilter: document.querySelector('#machines-filter'),
  dateFromFilter: document.querySelector('#date-from-filter'),
  dateToFilter: document.querySelector('#date-to-filter'),
  nameFilter: document.querySelector('#name-filter'),
  resetFiltersBtn: document.querySelector('#reset-filters-btn'),
  // Filter value displays
  humansValue: document.querySelector('#humans-value'),
  machinesValue: document.querySelector('#machines-value'),
  humansMin: document.querySelector('#humans-min'),
  humansMax: document.querySelector('#humans-max'),
  machinesMin: document.querySelector('#machines-min'),
  machinesMax: document.querySelector('#machines-max'),
};

async function fetchLogs() {
  showLoading(true);
  clearStatus();

  const token = localStorage.getItem('sb_jwt');
  if (!token) {
    setStatus('Authentication credentials missing. Redirecting...');
    setTimeout(() => {
      window.location.replace('index.html');
    }, 1500);
    return;
  }

  let logTable = localStorage.getItem('sb_log_table');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!logTable || !uuidRegex.test(logTable)) {
    try {
      // 1. Get user details from Auth
      const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!userResponse.ok) {
        throw new Error('Failed to retrieve user auth info.');
      }
      const userData = await userResponse.json();
      const email = userData.email;

      // 2. Fetch the user's log_table from public.users table using their email
      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?email_id=eq.${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile.');
      }
      const profileData = await profileResponse.json();
      if (!profileData || profileData.length === 0) {
        throw new Error('User profile not found.');
      }
      logTable = profileData[0].log_table;
      localStorage.setItem('sb_log_table', logTable);
    } catch (error) {
      console.error('Error fetching log table ID:', error);
      setStatus('Unable to retrieve user log profile identifier.');
      showLoading(false);
      return;
    }
  }

  const tablePill = document.getElementById('active-table-pill');
  if (tablePill && logTable) {
    tablePill.textContent = `Table: ${logTable}`;
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/logs`);
    url.searchParams.set('select', 'time_stamp,name,humans,machines,description');
    url.searchParams.set('unique_id', 'eq.' + logTable);
    url.searchParams.set('order', 'time_stamp.desc');
    url.searchParams.set('limit', '100');

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

    allLogs = Array.isArray(data) ? data : [];
    applyFiltersAndRender();
    updateStats(allLogs);

    if (!Array.isArray(data) || data.length === 0) {
      setStatus(`Fetched 0 rows. Confirm your telemetry edge is writing to table logs with unique_id: ${logTable}`);
    } else {
      setStatus(`Fetched ${data.length} rows from telemetry.`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    const message = error?.message || 'Unable to retrieve logs. Check Supabase keys and network access.';
    setStatus(message);
    allLogs = [];
    renderLogs([]);
  } finally {
    showLoading(false);
  }
}

function applyFiltersAndRender() {
  let filtered = allLogs;

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(log => {
      const name = String(log.name || '').toLowerCase();
      const desc = String(log.description || '').toLowerCase();
      const timestamp = String(log.time_stamp || '').toLowerCase();
      return name.includes(searchLower) || desc.includes(searchLower) || timestamp.includes(searchLower);
    });
  }

  // Humans filter
  filtered = filtered.filter(log => {
    const humans = Number(log.humans) || 0;
    return humans >= filters.minHumans && humans <= filters.maxHumans;
  });

  // Machines filter
  filtered = filtered.filter(log => {
    const machineCount = Array.isArray(log.machines) ? log.machines.length : 0;
    return machineCount >= filters.minMachines && machineCount <= filters.maxMachines;
  });

  // Machine name filter
  if (filters.machineName) {
    const nameFilter = filters.machineName.toLowerCase();
    filtered = filtered.filter(log => {
      if (!Array.isArray(log.machines)) return false;
      return log.machines.some(m => String(m.name || '').toLowerCase().includes(nameFilter));
    });
  }

  // Date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom).getTime();
    filtered = filtered.filter(log => new Date(log.time_stamp).getTime() >= fromDate);
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo).getTime();
    toDate.setHours(23, 59, 59, 999);
    filtered = filtered.filter(log => new Date(log.time_stamp).getTime() <= toDate);
  }

  renderLogs(filtered);
  updateFilterCount();
}

function updateFilterCount() {
  let count = 0;
  if (filters.search) count++;
  if (filters.minHumans > 0 || filters.maxHumans < 100) count++;
  if (filters.minMachines > 0 || filters.maxMachines < 20) count++;
  if (filters.machineName) count++;
  if (filters.dateFrom) count++;
  if (filters.dateTo) count++;

  if (count > 0) {
    elements.filterCount.textContent = count;
    elements.filterCount.style.display = 'inline-flex';
  } else {
    elements.filterCount.style.display = 'none';
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

  // Search functionality
  elements.searchInput.addEventListener('input', (e) => {
    filters.search = e.target.value;
    applyFiltersAndRender();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    filters.search = '';
    applyFiltersAndRender();
  });

  // Filter toggle
  elements.filterToggleBtn.addEventListener('click', () => {
    const isActive = elements.filterPanel.classList.toggle('active');
    elements.filterToggleBtn.setAttribute('aria-expanded', isActive);
  });

  // Humans filter
  elements.humansFilter.addEventListener('input', (e) => {
    filters.minHumans = Number(e.target.value);
    elements.humansValue.textContent = filters.minHumans > 0 ? `${filters.minHumans}+` : 'Any';
    elements.humansMin.textContent = filters.minHumans;
    applyFiltersAndRender();
  });

  // Machines filter
  elements.machinesFilter.addEventListener('input', (e) => {
    filters.minMachines = Number(e.target.value);
    elements.machinesValue.textContent = filters.minMachines > 0 ? `${filters.minMachines}+` : 'Any';
    elements.machinesMin.textContent = filters.minMachines;
    applyFiltersAndRender();
  });

  // Machine name filter
  elements.nameFilter.addEventListener('input', (e) => {
    filters.machineName = e.target.value;
    applyFiltersAndRender();
  });

  // Date filters
  elements.dateFromFilter.addEventListener('change', (e) => {
    filters.dateFrom = e.target.value;
    applyFiltersAndRender();
  });

  elements.dateToFilter.addEventListener('change', (e) => {
    filters.dateTo = e.target.value;
    applyFiltersAndRender();
  });

  // Reset filters
  elements.resetFiltersBtn.addEventListener('click', () => {
    filters.search = '';
    filters.minHumans = 0;
    filters.maxHumans = 100;
    filters.minMachines = 0;
    filters.maxMachines = 20;
    filters.dateFrom = '';
    filters.dateTo = '';
    filters.machineName = '';

    // Reset UI
    elements.searchInput.value = '';
    elements.humansFilter.value = 0;
    elements.machinesFilter.value = 0;
    elements.nameFilter.value = '';
    elements.dateFromFilter.value = '';
    elements.dateToFilter.value = '';
    elements.humansValue.textContent = 'Any';
    elements.machinesValue.textContent = 'Any';
    elements.humansMin.textContent = '0';
    elements.machinesMin.textContent = '0';

    applyFiltersAndRender();
  });

  // Logout functionality
  const logoutBtn = document.getElementById('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('sb_jwt');
      localStorage.removeItem('sb_log_table');
      window.location.replace('index.html');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Initialize particle system
  particleSystem = new ParticleSystem('particle-container');

  if (!elements.refreshButton || !elements.logBody) {
    console.error('Required DOM elements are missing.');
    setStatus('Unable to initialize dashboard UI.');
    return;
  }
  wireEvents();
  fetchLogs();
});
