import { api } from './api.js';
import { escapeHtml, initials, STATUS } from './dashboard.js';

const state = { page: 1, pageSize: 10, search: '', status: '', major: '', cohort: '', sortBy: 'createdAt', sortDir: 'desc', selected: new Set(), options: { majors: [], cohorts: [] } };

// Hỗ trợ cả API mới (enum dạng chuỗi) lẫn dữ liệu từ bản build cũ (enum dạng số).
const STATUS_FALLBACK = {
  0: 'Active',
  1: 'Pending',
  2: 'Leave',
  3: 'Graduated'
};

function statusKey(value) {
  if (typeof value === 'number') return STATUS_FALLBACK[value] ?? 'Active';
  return String(value ?? 'Active');
}
let callbacks = {};
let initialized = false;

export function initStudents(handlers) {
  callbacks = handlers;
  if (!initialized) {
    initialized = true;
    bindEvents();
    loadOptions().catch(callbacks.onError);
  }
  return loadStudents();
}

export async function loadStudents() {
  const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize, sortBy: state.sortBy, sortDir: state.sortDir });
  if (state.search) params.set('search', state.search);
  if (state.status) params.set('status', state.status);
  if (state.major) params.set('major', state.major);
  if (state.cohort) params.set('cohort', state.cohort);

  const data = await api.get(`/api/students?${params.toString()}`);
  renderRows(data.items);
  renderPagination(data.pagination);
}

async function loadOptions() {
  state.options = await api.get('/api/students/options');
  populateSelect('#major-filter', state.options.majors, 'Tất cả ngành');
  populateSelect('#cohort-filter', state.options.cohorts, 'Tất cả khóa');
  populateSelect('#student-major', state.options.majors, 'Chọn ngành');
  populateDatalist('#cohort-options', state.options.cohorts);
}


function populateDatalist(selector, values) {
  const list = $(selector);
  if (!list) return;
  list.innerHTML = (values || []).map(value => `<option value="${escapeHtml(String(value))}"></option>`).join('');
}

function bindEvents() {
  $('#student-search').addEventListener('input', debounce(e => { state.search = e.target.value.trim(); state.page = 1; loadStudents().catch(callbacks.onError); }, 250));
  $('#status-filter').addEventListener('change', e => { state.status = e.target.value; state.page = 1; loadStudents().catch(callbacks.onError); });
  $('#major-filter').addEventListener('change', e => { state.major = e.target.value; state.page = 1; loadStudents().catch(callbacks.onError); });
  $('#cohort-filter').addEventListener('change', e => { state.cohort = e.target.value; state.page = 1; loadStudents().catch(callbacks.onError); });
  $('#reset-filters').addEventListener('click', () => { state.search = state.status = state.major = state.cohort = ''; state.page = 1; $('#student-search').value = ''; $('#status-filter').value = ''; $('#major-filter').value = ''; $('#cohort-filter').value = ''; loadStudents().catch(callbacks.onError); });
  $('#select-all').addEventListener('change', e => { document.querySelectorAll('.row-check').forEach(cb => { cb.checked = e.target.checked; toggleSelection(Number(cb.dataset.id), e.target.checked); }); updateSelectionUI(); });
  $('#bulk-delete').addEventListener('click', bulkDelete);
  $('#export-btn').addEventListener('click', () => api.download('/api/students/export').then(() => callbacks.toast('Đã xuất file CSV.')).catch(callbacks.onError));
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => { const file = e.target.files?.[0]; if (!file) return; try { const result = await api.importCsv(file); callbacks.toast(`Import xong: thêm ${result.created}, bỏ qua ${result.skipped}.`); await loadStudents(); callbacks.reloadDashboard(); } catch (err) { callbacks.onError(err); } finally { e.target.value = ''; } });
  $('#student-rows').addEventListener('click', async e => {
    const button = e.target.closest('[data-action]'); if (!button) return;
    const id = Number(button.closest('tr').dataset.id);
    if (button.dataset.action === 'view') await callbacks.openDetail(id);
    if (button.dataset.action === 'edit') await callbacks.openEdit(id);
    if (button.dataset.action === 'delete') await deleteStudent(id);
    if (button.dataset.action === 'print') await printStudent(id);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.row-menu')) document.querySelectorAll('.row-menu.open').forEach(x => x.classList.remove('open')); });
  $('#student-rows').addEventListener('click', e => { const menu = e.target.closest('.menu-toggle'); if (menu) menu.parentElement.classList.toggle('open'); });
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => { const key = th.dataset.sort; if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'; else { state.sortBy = key; state.sortDir = 'asc'; } loadStudents().catch(callbacks.onError); }));
}

async function deleteStudent(id) {
  try {
    const detail = await api.get(`/api/students/${id}`);
    if (!confirm(`Xóa hồ sơ của ${detail.fullName}?`)) return;
    await api.del(`/api/students/${id}`);
    state.selected.delete(id);
    callbacks.toast('Đã xóa sinh viên.');
    await loadStudents();
    callbacks.reloadDashboard();
  } catch (err) { callbacks.onError(err); }
}

async function bulkDelete() {
  if (!state.selected.size) return;
  if (!confirm(`Xóa ${state.selected.size} sinh viên đã chọn?`)) return;
  try {
    const result = await api.post('/api/students/bulk-delete', [...state.selected]);
    state.selected.clear();
    callbacks.toast(`Đã xóa ${result.deleted} hồ sơ.`);
    updateSelectionUI();
    await loadStudents();
    callbacks.reloadDashboard();
  } catch (err) { callbacks.onError(err); }
}

export function getFormPayload() {
  return {
    studentCode: $('#student-code').value.trim(), fullName: $('#full-name').value.trim(), email: $('#student-email').value.trim(), phone: $('#student-phone').value.trim(),
    major: $('#student-major').value, cohort: $('#student-cohort').value, status: $('#student-status').value, gender: $('#student-gender').value,
    dateOfBirth: $('#student-dob').value ? `${$('#student-dob').value}T00:00:00` : null, address: $('#student-address').value.trim(), gpa: Number($('#student-gpa').value || 0)
  };
}

export async function saveForm() {
  const id = Number($('#student-id').value || 0);
  return id ? api.put(`/api/students/${id}`, getFormPayload()) : api.post('/api/students', getFormPayload());
}

export async function fillForm(id) {
  const s = await api.get(`/api/students/${id}`);
  $('#student-id').value = s.id;
  $('#student-code').value = s.studentCode;
  $('#full-name').value = s.fullName;
  $('#student-email').value = s.email;
  $('#student-phone').value = s.phone || '';
  $('#student-major').value = s.major;
  $('#student-cohort').value = s.cohort;
  $('#student-status').value = statusKey(s.status);
  $('#student-gender').value = s.gender;
  $('#student-dob').value = s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : '';
  $('#student-address').value = s.address || '';
  $('#student-gpa').value = Number(s.gpa).toFixed(2);
  return s;
}

export async function buildDetail(id) {
  const s = await api.get(`/api/students/${id}`);
  $('#student-detail-content').innerHTML = `<div class="profile-hero"><div class="profile-avatar">${initials(s.fullName)}</div><div><h3>${escapeHtml(s.fullName)}</h3><p>${escapeHtml(s.studentCode)} · ${escapeHtml(s.major)}</p><span class="badge ${STATUS[statusKey(s.status)]?.cls ?? 'green'}">${STATUS[statusKey(s.status)]?.label ?? 'Đang học'}</span></div></div><div class="detail-grid"><div><span>Email</span><strong>${escapeHtml(s.email)}</strong></div><div><span>Điện thoại</span><strong>${escapeHtml(s.phone || '—')}</strong></div><div><span>Khóa</span><strong>${escapeHtml(s.cohort)}</strong></div><div><span>GPA</span><strong>${Number(s.gpa).toFixed(2)} / 4.00</strong></div><div><span>Giới tính</span><strong>${s.gender === 'Male' ? 'Nam' : s.gender === 'Female' ? 'Nữ' : 'Khác'}</strong></div><div><span>Ngày sinh</span><strong>${s.dateOfBirth ? new Intl.DateTimeFormat('vi-VN').format(new Date(s.dateOfBirth)) : '—'}</strong></div><div class="span-2"><span>Địa chỉ</span><strong>${escapeHtml(s.address || '—')}</strong></div></div>`;
  return s;
}

async function printStudent(id) {
  try {
    const s = await api.get(`/api/students/${id}`);
    const popup = window.open('', '_blank', 'width=720,height=800');
    if (!popup) return;
    popup.document.write(`<html lang="vi"><head><title>Hồ sơ ${escapeHtml(s.studentCode)}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#172436}h1{margin:0 0 6px}.card{border:1px solid #ddd;border-radius:16px;padding:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px}.item span{display:block;color:#8390a1;font-size:12px;margin-bottom:5px}.item strong{font-size:15px}</style></head><body><div class="card"><h1>Campus</h1><p>Phiếu hồ sơ sinh viên</p><h2>${escapeHtml(s.fullName)}</h2><div class="grid">${[['Mã SV',s.studentCode],['Ngành',s.major],['Email',s.email],['Điện thoại',s.phone||'—'],['Khóa',s.cohort],['GPA',Number(s.gpa).toFixed(2)],['Trạng thái',STATUS[s.status].label],['Địa chỉ',s.address||'—']].map(([a,b])=>`<div class="item"><span>${a}</span><strong>${escapeHtml(b)}</strong></div>`).join('')}</div></div><script>window.print();</script></body></html>`);
    popup.document.close();
  } catch (err) { callbacks.onError(err); }
}

function renderRows(items) {
  const body = $('#student-rows');
  $('#student-empty').classList.toggle('hidden', items.length > 0);
  body.innerHTML = items.map(s => `<tr data-id="${s.id}"><td class="check-col"><input class="row-check" data-id="${s.id}" type="checkbox" ${state.selected.has(s.id) ? 'checked' : ''}></td><td><div class="student-cell"><div class="student-avatar">${initials(s.fullName)}</div><div><strong>${escapeHtml(s.fullName)}</strong><span>${escapeHtml(s.email)}</span></div></div></td><td class="mono">${escapeHtml(s.studentCode)}</td><td>${escapeHtml(s.major)}</td><td>${escapeHtml(s.cohort)}</td><td><strong>${Number(s.gpa).toFixed(2)}</strong></td><td><span class="badge ${STATUS[statusKey(s.status)]?.cls ?? 'green'}">${STATUS[statusKey(s.status)]?.label ?? 'Đang học'}</span></td><td><div class="row-menu"><button class="menu-toggle">•••</button><div class="menu-pop"><button data-action="view">Xem hồ sơ</button><button data-action="edit">Chỉnh sửa</button><button data-action="print">In hồ sơ</button><button class="danger-text" data-action="delete">Xóa</button></div></div></td></tr>`).join('');
  body.querySelectorAll('.row-check').forEach(cb => cb.addEventListener('change', e => { toggleSelection(Number(e.target.dataset.id), e.target.checked); updateSelectionUI(); }));
  $('#table-count').textContent = `Hiển thị ${items.length} / ${window.__studentsTotal ?? 0} sinh viên`;
  updateSelectionUI();
}

function renderPagination(info) {
  window.__studentsTotal = info.total;
  $('#table-count').textContent = `Tổng ${info.total.toLocaleString('vi-VN')} sinh viên`;
  $('#pagination-label').textContent = info.total ? `Trang ${info.page} / ${info.totalPages}` : 'Không có kết quả';
  const root = $('#pagination');
  const pages = [];
  const start = Math.max(1, info.page - 2); const end = Math.min(info.totalPages, info.page + 2);
  pages.push(`<button class="page-btn" ${info.page === 1 ? 'disabled' : ''} data-page="${info.page - 1}">‹</button>`);
  for (let p = start; p <= end; p++) pages.push(`<button class="page-btn ${p === info.page ? 'active' : ''}" data-page="${p}">${p}</button>`);
  pages.push(`<button class="page-btn" ${info.page === info.totalPages || !info.totalPages ? 'disabled' : ''} data-page="${info.page + 1}">›</button>`);
  root.innerHTML = pages.join('');
  root.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => { if (btn.disabled) return; state.page = Number(btn.dataset.page); loadStudents().catch(callbacks.onError); }));
}

function updateSelectionUI() {
  const count = state.selected.size;
  $('#selected-count').classList.toggle('hidden', count === 0);
  $('#selected-count').textContent = `${count} đã chọn`;
  $('#bulk-delete').classList.toggle('hidden', count === 0);
  const rows = [...document.querySelectorAll('.row-check')];
  $('#select-all').checked = rows.length > 0 && rows.every(x => x.checked);
}
function toggleSelection(id, checked) { if (checked) state.selected.add(id); else state.selected.delete(id); }
function populateSelect(selector, values, firstLabel) { const root = $(selector); root.innerHTML = `<option value="">${firstLabel}</option>` + values.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(''); }
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }
function $(selector) { return document.querySelector(selector); }
