// ============================================
// 홈피몬스터 관리자 — admin.js
// ============================================
// 기능: DB 관리, 검색, 날짜 필터, 페이지네이션,
//       엑셀 다운로드/업로드, 선택 삭제, 설정 관리
// ============================================

// --- Configuration ---
const CONFIG = {
    SUPABASE_URL: 'https://ctszrxwezwvisvqkcrzg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0c3pyeHdlend2aXN2cWtjcnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDI2NjEsImV4cCI6MjEwMDk3ODY2MX0.ElX97vgA6rULL_W-SwD87cOvAlTI00gKaVgansTLiXg',
    ADMIN_PASSWORD_HASH: 'admin123',
    PAGE_SIZE: 20
};

// --- State ---
let leadsData = [];
let currentLeadId = null;
let currentPage = 1;
let totalCount = 0;
let searchQuery = '';
let dateFilter = 'all'; // 'today', 'week', 'all', 'custom'
let customDateStart = null;
let customDateEnd = null;
let selectedIds = new Set();

// --- Supabase Setup ---
const supabaseClient = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

// --- DOM Elements ---
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const navItems = document.querySelectorAll('.nav-item');
const settingsPanel = document.getElementById('settings-panel');
const contentBasic = document.getElementById('content-basic');
const contentOther = document.getElementById('content-other');

const tableBody = document.getElementById('leads-table-body');
const statLeads = document.getElementById('stat-leads');
const statViews = document.getElementById('stat-views');
const statConv = document.getElementById('stat-conv');

const detailPopup = document.getElementById('detail-popup');
const closePopupBtn = document.getElementById('close-popup');

// Toggle state
const togglesState = {
    scripts: false,
    pixels: false,
    webhook: false,
    telegram: false,
    redirect: false,
    duplicate: true
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkLogin();
    setupNavigation();
    setupSearch();
    setupDateFilters();
    setupDateRangePicker();

    if (!supabaseClient || CONFIG.SUPABASE_URL.includes('your-project')) {
        console.warn('Supabase not configured properly. Using mock data.');
        useMockData();
    } else {
        fetchLeads();
        fetchSettings();
    }
    setupAutoSave();
});

// ============================================
// Auth Logic
// ============================================
function checkLogin() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        loginOverlay.classList.add('hidden');
    }
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === CONFIG.ADMIN_PASSWORD_HASH) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        loginOverlay.style.opacity = '0';
        setTimeout(() => loginOverlay.classList.add('hidden'), 300);
        loginError.classList.add('hidden');
    } else {
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('adminLoggedIn');
    loginOverlay.classList.remove('hidden');
    loginOverlay.style.opacity = '1';
    passwordInput.value = '';
});

// ============================================
// Navigation Logic (기존 유지)
// ============================================
function setupNavigation() {
    document.getElementById('main-content').addEventListener('click', () => {
        settingsPanel.classList.add('-translate-x-full');
        setTimeout(() => {
            if (document.querySelector('.nav-item.active')?.dataset.target === 'db') {
                settingsPanel.classList.add('hidden');
            }
        }, 300);
        navItems.forEach(nav => {
            nav.classList.remove('active', 'border-primary', 'text-primary', 'bg-[#eff6ff]');
            nav.classList.add('border-transparent', 'text-gray-400');
            if (nav.dataset.target === 'db') {
                nav.classList.add('active', 'border-primary', 'text-primary', 'bg-[#eff6ff]');
                nav.classList.remove('border-transparent', 'text-gray-400');
            }
        });
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            if (item.classList.contains('active') && target !== 'db') {
                document.querySelector('[data-target="db"]').click();
                return;
            }
            navItems.forEach(nav => {
                nav.classList.remove('active', 'border-primary', 'text-primary', 'bg-[#eff6ff]');
                nav.classList.add('border-transparent', 'text-gray-400');
            });
            item.classList.add('active', 'border-primary', 'text-primary', 'bg-[#eff6ff]');
            item.classList.remove('border-transparent', 'text-gray-400');
            if (target === 'db') {
                settingsPanel.classList.add('-translate-x-full');
                setTimeout(() => {
                    if (document.querySelector('.nav-item.active')?.dataset.target === 'db') {
                        settingsPanel.classList.add('hidden');
                    }
                }, 300);
            } else {
                settingsPanel.classList.remove('hidden');
                setTimeout(() => settingsPanel.classList.remove('-translate-x-full'), 10);
                contentBasic.classList.add('hidden');
                contentOther.classList.add('hidden');
                if (target === 'basic') contentBasic.classList.remove('hidden');
                if (target === 'other') contentOther.classList.remove('hidden');
            }
        });
    });
}

// ============================================
// Toggle Logic (기존 유지)
// ============================================
function updateToggleUI(id, isChecked) {
    const btn = document.getElementById(`toggle-${id}-btn`);
    const container = document.getElementById(`${id}-container`);
    const span = btn?.querySelector('span');
    if (!btn || !span) return;

    togglesState[id] = isChecked;

    if (isChecked) {
        btn.classList.remove('bg-[#E5E8EB]');
        btn.classList.add('bg-primary');
        span.classList.remove('translate-x-0');
        span.classList.add('translate-x-[18px]');
        if (id === 'redirect') {
            document.getElementById('setting-redirect-url').disabled = false;
            document.getElementById('setting-redirect-url').classList.remove('bg-gray-50', 'text-gray-400', 'cursor-not-allowed');
            document.getElementById('setting-redirect-url').classList.add('bg-white', 'text-gray-800');
            document.getElementById('setting-completion-message').disabled = true;
            document.getElementById('completion-msg-container').classList.add('bg-gray-50');
            document.getElementById('completion-msg-container').classList.remove('bg-white');
            document.getElementById('setting-completion-message').classList.add('text-gray-400');
        } else if (container) {
            container.classList.remove('hidden');
        }
    } else {
        btn.classList.add('bg-[#E5E8EB]');
        btn.classList.remove('bg-primary');
        span.classList.add('translate-x-0');
        span.classList.remove('translate-x-[18px]');
        if (id === 'redirect') {
            document.getElementById('setting-redirect-url').disabled = true;
            document.getElementById('setting-redirect-url').classList.add('bg-gray-50', 'text-gray-400', 'cursor-not-allowed');
            document.getElementById('setting-redirect-url').classList.remove('bg-white', 'text-gray-800');
            document.getElementById('setting-completion-message').disabled = false;
            document.getElementById('completion-msg-container').classList.remove('bg-gray-50');
            document.getElementById('completion-msg-container').classList.add('bg-white');
            document.getElementById('setting-completion-message').classList.remove('text-gray-400');
        } else if (container) {
            container.classList.add('hidden');
        }
    }
}

function bindToggleClick(id) {
    const btn = document.getElementById(`toggle-${id}-btn`);
    if (!btn) return;
    btn.addEventListener('click', () => {
        updateToggleUI(id, !togglesState[id]);
        const type = document.getElementById('content-basic').classList.contains('hidden') ? 'other' : 'basic';
        window.saveSettings(type);
    });
}

bindToggleClick('scripts');
bindToggleClick('pixels');
bindToggleClick('webhook');
bindToggleClick('telegram');
bindToggleClick('redirect');
bindToggleClick('duplicate');

// ============================================
// Search
// ============================================
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    if (!searchInput || !searchBtn) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    searchBtn.addEventListener('click', performSearch);
}

function performSearch() {
    const input = document.getElementById('search-input');
    searchQuery = input.value.trim();
    currentPage = 1;
    fetchLeads();
}

// ============================================
// Date Filters
// ============================================
function setupDateFilters() {
    const btnToday = document.getElementById('filter-today');
    const btnWeek = document.getElementById('filter-week');
    const btnAll = document.getElementById('filter-all');

    if (btnToday) btnToday.addEventListener('click', () => setDateFilter('today'));
    if (btnWeek) btnWeek.addEventListener('click', () => setDateFilter('week'));
    if (btnAll) btnAll.addEventListener('click', () => setDateFilter('all'));
}

function setDateFilter(filter) {
    dateFilter = filter;
    currentPage = 1;

    // Update button styles
    const activeClasses = 'px-3.5 py-1.5 text-primary bg-white rounded-lg shadow-xs font-bold border border-gray-200/60 text-[13px]';
    const inactiveClasses = 'px-3.5 py-1.5 text-gray-500 hover:text-gray-800 transition-colors text-[13px] font-medium rounded-lg border border-transparent';

    ['today', 'week', 'all'].forEach(key => {
        const id = `filter-${key}`;
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.className = key === filter ? activeClasses : inactiveClasses;
    });

    // Update date range display
    updateDateRangeDisplay();
    fetchLeads();
}

function updateDateRangeDisplay() {
    const display = document.getElementById('date-range-display');
    if (!display) return;

    const now = new Date();
    switch (dateFilter) {
        case 'today': {
            display.textContent = now.toLocaleDateString('ko-KR');
            break;
        }
        case 'week': {
            const start = new Date(now);
            start.setDate(now.getDate() - 7);
            display.textContent = `${formatDate(start)} ~ ${formatDate(now)}`;
            break;
        }
        case 'custom': {
            if (customDateStart && customDateEnd) {
                display.textContent = `${customDateStart} ~ ${customDateEnd}`;
            }
            break;
        }
        default:
            display.textContent = '전체 기간';
    }
}

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================
// Date Range Picker
// ============================================
function setupDateRangePicker() {
    const btn = document.getElementById('date-range-btn');
    const dropdown = document.getElementById('date-range-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.classList.add('hidden');
        }
    });
}

window.applyCustomDateRange = function () {
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if (!startInput?.value || !endInput?.value) {
        alert('시작일과 종료일을 모두 선택해주세요.');
        return;
    }
    if (startInput.value > endInput.value) {
        alert('시작일이 종료일보다 클 수 없습니다.');
        return;
    }
    customDateStart = startInput.value;
    customDateEnd = endInput.value;
    dateFilter = 'custom';
    currentPage = 1;

    // Reset filter button styles
    ['filter-today', 'filter-week', 'filter-all'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = 'px-3.5 py-1.5 text-gray-500 hover:text-gray-800 transition-colors text-[13px] font-medium rounded-lg border border-transparent';
    });

    updateDateRangeDisplay();
    document.getElementById('date-range-dropdown')?.classList.add('hidden');
    fetchLeads();
};

// ============================================
// Date Range Helper
// ============================================
function getDateRange() {
    const now = new Date();
    switch (dateFilter) {
        case 'today': {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return { start: start.toISOString(), end: now.toISOString() };
        }
        case 'week': {
            const start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            return { start: start.toISOString(), end: now.toISOString() };
        }
        case 'custom': {
            if (customDateStart && customDateEnd) {
                const end = new Date(customDateEnd);
                end.setHours(23, 59, 59, 999);
                return { start: new Date(customDateStart).toISOString(), end: end.toISOString() };
            }
            return { start: null, end: null };
        }
        default:
            return { start: null, end: null };
    }
}

// ============================================
// Data Fetching
// ============================================
async function fetchLeads() {
    if (!supabaseClient) return;
    try {
        const from = (currentPage - 1) * CONFIG.PAGE_SIZE;
        const to = from + CONFIG.PAGE_SIZE - 1;

        let query = supabaseClient
            .from('leads')
            .select('*', { count: 'exact' })
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, to);

        // Date filter
        const dateRange = getDateRange();
        if (dateRange.start) query = query.gte('created_at', dateRange.start);
        if (dateRange.end) query = query.lte('created_at', dateRange.end);

        // Search
        if (searchQuery) {
            query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        leadsData = data || [];
        totalCount = count || 0;
        selectedIds.clear();
        renderTable();
        renderPagination();
        updateStats();
        updateSelectAllCheckbox();
    } catch (err) {
        console.error('fetchLeads error:', err);
    }
}

function useMockData() {
    leadsData = [
        {
            id: '1', created_at: new Date().toISOString(),
            customer_name: '홍길동', customer_phone: '010-1234-5678',
            form_data: { industry: '음식점', question: '상담 문의' },
            status: '신규접수', manager: '', memo: '',
            ip_address: '222.100.195.9', platform: '직접유입'
        }
    ];
    totalCount = 1;
    renderTable();
    renderPagination();
    updateStats();
}

// ============================================
// Table Rendering
// ============================================
function renderTable() {
    tableBody.innerHTML = '';
    if (leadsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="py-28 text-center text-gray-400 text-[15px] font-medium">데이터가 없습니다.</td></tr>';
        return;
    }

    const startNo = totalCount - (currentPage - 1) * CONFIG.PAGE_SIZE;

    leadsData.forEach((lead, index) => {
        const d = new Date(lead.created_at);
        const dateStr = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        const isNew = !lead.status || lead.status === '신규' || lead.status === '신규접수';
        const statusBadge = isNew
            ? `<span class="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold text-[#2563eb] bg-[#eff6ff]">신규</span>`
            : `<span class="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold text-[#4b5563] bg-[#f3f4f6]">${lead.status}</span>`;

        const isChecked = selectedIds.has(lead.id);

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/60 transition-colors border-b border-gray-100 cursor-pointer text-xs text-gray-700 h-[52px]';
        tr.onclick = (e) => {
            if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON') openDetailPopup(lead.id);
        };

        tr.innerHTML = `
            <td class="py-3 text-center align-middle"><input type="checkbox" class="row-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer align-middle" data-id="${lead.id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleRowSelect('${lead.id}', this.checked)"></td>
            <td class="py-3 text-center align-middle"><span class="inline-flex items-center justify-center px-2 py-0.5 bg-[#f1f5f9] text-gray-700 font-bold rounded text-xs min-w-[24px]">${startNo - index}</span></td>
            <td class="py-3 text-center align-middle text-gray-500 font-normal">${lead.ip_address || '-'}</td>
            <td class="py-3 text-center align-middle"><span class="inline-block px-2 py-0.5 bg-[#f1f5f9] text-gray-600 font-medium rounded text-[11px]">${lead.platform || '기타'}</span></td>
            <td class="py-3 text-center align-middle text-gray-500 font-normal">${dateStr}</td>
            <td class="py-3 text-center align-middle text-gray-500 font-normal">${timeStr}</td>
            <td class="py-3 text-center align-middle text-gray-900 font-medium">${lead.customer_name || '-'}</td>
            <td class="py-3 text-center align-middle text-gray-600 font-normal">${lead.customer_phone || '-'}</td>
            <td class="py-3 text-center align-middle">${statusBadge}</td>
            <td class="py-3 text-center align-middle"><span class="inline-block px-2.5 py-1 bg-[#f1f5f9] text-gray-500 text-[11px] font-semibold rounded-md">${lead.manager || '미정'}</span></td>
            <td class="py-3 text-center align-middle"><button class="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-lg text-[11px] font-medium hover:bg-gray-50 transition-colors shadow-2xs" onclick="event.stopPropagation(); openDetailPopup('${lead.id}')">상세 보기</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

// ============================================
// Pagination
// ============================================
function renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / CONFIG.PAGE_SIZE));
    container.innerHTML = '';

    // Prev button
    const prevBtn = document.createElement('button');
    prevBtn.className = `p-1 ${currentPage <= 1 ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700'}`;
    prevBtn.innerHTML = '<i data-lucide="chevron-left" class="w-5 h-5"></i>';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; fetchLeads(); } };
    container.appendChild(prevBtn);

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        if (i === currentPage) {
            pageBtn.className = 'w-7 h-7 rounded-md bg-primary text-white text-xs font-bold flex items-center justify-center shadow-sm shadow-blue-200';
        } else {
            pageBtn.className = 'w-7 h-7 rounded-md text-gray-500 text-xs font-bold flex items-center justify-center hover:bg-gray-100';
        }
        pageBtn.textContent = i;
        pageBtn.onclick = () => { currentPage = i; fetchLeads(); };
        container.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `p-1 ${currentPage >= totalPages ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700'}`;
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-5 h-5"></i>';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; fetchLeads(); } };
    container.appendChild(nextBtn);

    // Re-render lucide icons for the new buttons
    lucide.createIcons();
}

// ============================================
// Stats
// ============================================
function updateStats() {
    const views = totalCount * 15;
    statViews.textContent = views.toLocaleString();
    statLeads.textContent = totalCount.toLocaleString();
    statConv.textContent = views > 0 ? ((totalCount / views) * 100).toFixed(1) + '%' : '0.0%';
}

// ============================================
// Select All / Row Select
// ============================================
window.toggleSelectAll = function (checked) {
    if (checked) {
        leadsData.forEach(lead => selectedIds.add(lead.id));
    } else {
        selectedIds.clear();
    }
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = checked);
};

window.toggleRowSelect = function (id, checked) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateSelectAllCheckbox();
};

function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('select-all-checkbox');
    if (selectAll) {
        selectAll.checked = leadsData.length > 0 && selectedIds.size === leadsData.length;
    }
}

// ============================================
// Bulk Delete (Soft Delete)
// ============================================
window.bulkDelete = async function () {
    if (selectedIds.size === 0) {
        alert('삭제할 항목을 선택해주세요.');
        return;
    }
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;

    if (supabaseClient) {
        const ids = Array.from(selectedIds);
        const { error } = await supabaseClient
            .from('leads')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids);
        if (error) {
            alert('삭제 실패: ' + error.message);
            return;
        }
    }

    selectedIds.clear();
    fetchLeads();
};

// ============================================
// Excel Download
// ============================================
window.downloadExcel = async function () {
    if (!supabaseClient || typeof XLSX === 'undefined') {
        alert('엑셀 기능을 사용할 수 없습니다.');
        return;
    }

    // Fetch ALL leads matching current filters
    let query = supabaseClient
        .from('leads')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    const dateRange = getDateRange();
    if (dateRange.start) query = query.gte('created_at', dateRange.start);
    if (dateRange.end) query = query.lte('created_at', dateRange.end);
    if (searchQuery) query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);

    const { data, error } = await query;
    if (error) { alert('데이터 조회 실패: ' + error.message); return; }
    if (!data || data.length === 0) { alert('다운로드할 데이터가 없습니다.'); return; }

    const rows = data.map((lead, i) => ({
        'No': data.length - i,
        '이름': lead.customer_name || '',
        '전화번호': lead.customer_phone || '',
        '업종': lead.form_data?.industry || '',
        '문의내용': lead.form_data?.question || '',
        '상태': lead.status || '',
        '담당자': lead.manager || '',
        '메모': lead.memo || '',
        'IP': lead.ip_address || '',
        '플랫폼': lead.platform || '',
        '접수일시': new Date(lead.created_at).toLocaleString('ko-KR')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DB');
    XLSX.writeFile(wb, `홈피몬스터_DB_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================
// Excel Upload
// ============================================
window.triggerExcelUpload = function () {
    document.getElementById('excel-upload-input')?.click();
};

window.handleExcelUpload = async function (file) {
    if (!file || !supabaseClient || typeof XLSX === 'undefined') return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(ws);

            if (rawData.length === 0) { alert('업로드할 데이터가 없습니다.'); return; }
            if (!confirm(`${rawData.length}건의 데이터를 업로드하시겠습니까?`)) return;

            const leads = rawData.map(row => ({
                customer_name: row['이름'] || '',
                customer_phone: String(row['전화번호'] || ''),
                form_data: { industry: row['업종'] || '', question: row['문의내용'] || '' },
                status: row['상태'] || '신규접수',
                manager: row['담당자'] || '',
                memo: row['메모'] || '',
                platform: row['플랫폼'] || '엑셀업로드'
            }));

            const { error } = await supabaseClient.from('leads').insert(leads);
            if (error) throw error;
            alert(`${leads.length}건이 업로드되었습니다.`);
            fetchLeads();
        } catch (err) {
            console.error('Excel upload error:', err);
            alert('업로드 실패: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
};

// ============================================
// Detail Popup
// ============================================
function openDetailPopup(id) {
    currentLeadId = id;
    const lead = leadsData.find(l => l.id === id);
    if (!lead) return;

    const d = new Date(lead.created_at);
    document.getElementById('popup-name').textContent = `${lead.customer_name || '-'}님`;

    // Badge
    const badge = document.getElementById('popup-badge');
    if (lead.status === '신규접수') {
        badge.textContent = '신규접수';
        badge.className = 'px-3 py-1 text-xs font-bold text-primary bg-[#eff6ff] border border-blue-200 rounded-full';
    } else {
        badge.textContent = lead.status || '상담완료';
        badge.className = 'px-3 py-1 text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded-full';
    }

    document.getElementById('popup-phone').textContent = lead.customer_phone || '-';
    document.getElementById('popup-ip').textContent = lead.ip_address || '-';
    document.getElementById('popup-date').textContent = d.toLocaleDateString('ko-KR');
    document.getElementById('popup-time').textContent = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('popup-manager').textContent = lead.manager || '미정';

    // Manager input
    const managerInput = document.getElementById('popup-manager-input');
    if (managerInput) managerInput.value = lead.manager || '';

    // Status select
    const statusSelect = document.getElementById('popup-status-select');
    statusSelect.value = lead.status || '신규접수';

    statusSelect.onchange = async (e) => {
        const newStatus = e.target.value;
        if (supabaseClient) {
            await supabaseClient.from('leads').update({ status: newStatus }).eq('id', currentLeadId);
        }
        lead.status = newStatus;
        renderTable();
        if (newStatus === '신규접수') {
            badge.textContent = '신규접수';
            badge.className = 'px-3 py-1 text-xs font-bold text-primary bg-[#eff6ff] border border-blue-200 rounded-full';
        } else {
            badge.textContent = newStatus;
            badge.className = 'px-3 py-1 text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded-full';
        }
    };

    // form_data display
    const questionEl = document.getElementById('popup-question');
    const platformEl = document.getElementById('popup-platform');
    if (questionEl) {
        const q = lead.form_data?.question;
        questionEl.textContent = q || '문의 내용 없음';
    }
    if (platformEl) {
        platformEl.textContent = lead.platform || '기타';
    }

    // Memo
    document.getElementById('popup-memo-input').value = lead.memo || '';

    detailPopup.classList.add('show');
}

closePopupBtn.addEventListener('click', () => {
    detailPopup.classList.remove('show');
});

// ============================================
// Memo Save (+ Manager Save)
// ============================================
document.getElementById('btn-save-memo').addEventListener('click', async () => {
    if (!currentLeadId) return;
    const memo = document.getElementById('popup-memo-input').value;
    const manager = document.getElementById('popup-manager-input')?.value || '';
    const lead = leadsData.find(l => l.id === currentLeadId);

    if (supabaseClient) {
        await supabaseClient.from('leads').update({ memo, manager }).eq('id', currentLeadId);
    }
    if (lead) {
        lead.memo = memo;
        lead.manager = manager;
    }

    // Update manager display in popup
    document.getElementById('popup-manager').textContent = manager || '미정';

    // Re-render table to show updated manager
    renderTable();

    // UI Feedback
    const btn = document.getElementById('btn-save-memo');
    const originalText = btn.textContent;
    btn.textContent = '저장됨!';
    btn.classList.add('bg-green-500');
    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('bg-green-500');
    }, 2000);
});

// ============================================
// Individual Delete (Soft Delete)
// ============================================
document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!currentLeadId) return;
    if (!confirm('정말 이 데이터를 삭제하시겠습니까?')) return;

    if (supabaseClient) {
        await supabaseClient
            .from('leads')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', currentLeadId);
    }

    leadsData = leadsData.filter(l => l.id !== currentLeadId);
    totalCount = Math.max(0, totalCount - 1);
    renderTable();
    renderPagination();
    updateStats();
    detailPopup.classList.remove('show');
});

// ============================================
// Settings Load & Save (기존 유지)
// ============================================
async function fetchSettings() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('external_settings').select('*').eq('id', 1).single();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            const pc = data.page_config || {};

            if (document.getElementById('setting-page-name')) document.getElementById('setting-page-name').value = data.page_name || '';
            if (document.getElementById('top-page-name-display') && data.page_name) document.getElementById('top-page-name-display').textContent = data.page_name;
            if (document.getElementById('setting-og-title')) document.getElementById('setting-og-title').value = data.og_title || '';
            if (document.getElementById('setting-og-desc')) document.getElementById('setting-og-desc').value = data.og_description || '';
            if (document.getElementById('setting-head-script')) document.getElementById('setting-head-script').value = data.head_script || '';
            if (document.getElementById('setting-foot-script')) document.getElementById('setting-foot-script').value = data.foot_script || '';
            updateToggleUI('scripts', pc.scripts === true);

            if (document.getElementById('setting-meta-pixel')) document.getElementById('setting-meta-pixel').value = data.meta_pixel_id || '';
            if (document.getElementById('setting-google-ads')) document.getElementById('setting-google-ads').value = data.google_ads_id || '';
            if (document.getElementById('setting-kakao-pixel')) document.getElementById('setting-kakao-pixel').value = data.kakao_pixel_id || '';
            if (document.getElementById('setting-tiktok-pixel')) document.getElementById('setting-tiktok-pixel').value = data.tiktok_pixel_id || '';
            if (document.getElementById('setting-daangn-pixel')) document.getElementById('setting-daangn-pixel').value = data.daangn_pixel_id || '';
            if (document.getElementById('setting-clarity-id')) document.getElementById('setting-clarity-id').value = data.clarity_id || '';
            updateToggleUI('pixels', pc.pixels === true);

            if (document.getElementById('setting-webhook-url')) document.getElementById('setting-webhook-url').value = data.webhook_url || '';
            updateToggleUI('webhook', pc.webhook === true);

            if (document.getElementById('setting-telegram-token')) document.getElementById('setting-telegram-token').value = data.telegram_bot_token || '';
            if (document.getElementById('setting-telegram-chat')) document.getElementById('setting-telegram-chat').value = data.telegram_chat_id || '';
            updateToggleUI('telegram', pc.telegram === true);

            if (document.getElementById('setting-ip-block')) document.getElementById('setting-ip-block').value = data.ip_block_list || '';
            if (document.getElementById('setting-completion-message')) document.getElementById('setting-completion-message').value = data.completion_message || '';
            if (document.getElementById('setting-redirect-url')) document.getElementById('setting-redirect-url').value = data.redirect_url || '';
            updateToggleUI('redirect', pc.redirect === true);
            updateToggleUI('duplicate', pc.duplicate !== false);
        }
    } catch (err) {
        console.error('Error fetching settings:', err);
    }
}

window.saveSettings = async function (type) {
    if (!supabaseClient) return alert('DB 연결이 안되어 있습니다.');

    let updates = { id: 1 };

    if (type === 'basic') {
        updates.page_name = document.getElementById('setting-page-name')?.value || '';
        if (document.getElementById('top-page-name-display') && updates.page_name) {
            document.getElementById('top-page-name-display').textContent = updates.page_name;
        }
        updates.og_title = document.getElementById('setting-og-title')?.value || '';
        updates.og_description = document.getElementById('setting-og-desc')?.value || '';
        updates.head_script = document.getElementById('setting-head-script')?.value || '';
        updates.foot_script = document.getElementById('setting-foot-script')?.value || '';
        updates.meta_pixel_id = document.getElementById('setting-meta-pixel')?.value || '';
        updates.google_ads_id = document.getElementById('setting-google-ads')?.value || '';
        updates.kakao_pixel_id = document.getElementById('setting-kakao-pixel')?.value || '';
        updates.tiktok_pixel_id = document.getElementById('setting-tiktok-pixel')?.value || '';
        updates.daangn_pixel_id = document.getElementById('setting-daangn-pixel')?.value || '';
        updates.clarity_id = document.getElementById('setting-clarity-id')?.value || '';
        updates.webhook_url = document.getElementById('setting-webhook-url')?.value || '';
        updates.telegram_bot_token = document.getElementById('setting-telegram-token')?.value || '';
        updates.telegram_chat_id = document.getElementById('setting-telegram-chat')?.value || '';
    } else if (type === 'other') {
        updates.ip_block_list = document.getElementById('setting-ip-block')?.value || '';
        updates.completion_message = document.getElementById('setting-completion-message')?.value || '';
        updates.redirect_url = document.getElementById('setting-redirect-url')?.value || '';
    }

    // JSONB 토글 상태는 항상 최신화
    updates.page_config = {
        scripts: togglesState.scripts,
        pixels: togglesState.pixels,
        webhook: togglesState.webhook,
        telegram: togglesState.telegram,
        redirect: togglesState.redirect,
        duplicate: togglesState.duplicate
    };
    updates.updated_at = new Date().toISOString();

    try {
        const { error } = await supabaseClient.from('external_settings').upsert(updates);
        if (error) {
            throw error;
        }
        showSaveNotification('✓ 저장되었습니다');
    } catch (err) {
        console.error('Error saving settings:', err);
        showSaveNotification('❌ 저장 실패');
    }
};

function showSaveNotification(msg) {
    const notif = document.getElementById('save-notification');
    if (!notif) return;
    notif.textContent = msg;
    notif.classList.remove('opacity-0');
    setTimeout(() => {
        notif.classList.add('opacity-0');
    }, 2000);
}

// Auto-save logic
let autoSaveTimeout = null;
function setupAutoSave() {
    const inputs = document.querySelectorAll('#settings-panel input, #settings-panel textarea, #settings-panel select');
    inputs.forEach(input => {
        ['input', 'change'].forEach(evtType => {
            input.addEventListener(evtType, () => {
                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = setTimeout(() => {
                    const type = document.getElementById('content-basic').classList.contains('hidden') ? 'other' : 'basic';
                    window.saveSettings(type);
                }, 800);
            });
        });
    });
}
