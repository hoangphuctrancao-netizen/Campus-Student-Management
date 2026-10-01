import { api } from './api.js';
import { storage } from './storage.js';
import { loadDashboard } from './dashboard.js';
import { initStudents, loadStudents, fillForm, saveForm, buildDetail } from './students.js';

const views = { dashboard: 'Tổng quan', students: 'Sinh viên', audit: 'Nhật ký', settings: 'Cài đặt' };
let currentUser = null;
let detailId = 0;
let toastTimer;

boot();

async function boot() {
  document.querySelector('#today').textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  applyTheme(storage.theme);
  bindShell();
  try {
    const me = await api.get('/api/auth/me');
    enterApp(me.user);
  } catch {
    showLogin();
  }
}

function bindShell() {
  document.querySelector('#login-form').addEventListener('submit', handleLogin);
  document.querySelector('#logout-btn').addEventListener('click', async () => { try { await api.logout(); } finally { showLogin(); } });
  document.querySelector('#theme-btn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.querySelector('#dark-toggle').addEventListener('change', e => applyTheme(e.target.checked ? 'dark' : 'light'));
  document.querySelector('#refresh-btn').addEventListener('click', refreshCurrentView);
  document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
  document.querySelector('#sidebar-overlay').addEventListener('click', () => document.querySelector('#sidebar').classList.remove('open'));
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  document.querySelector('#global-search').addEventListener('keydown', e => { if (e.key === 'Enter') { navigate('students'); document.querySelector('#student-search').value = e.target.value; document.querySelector('#student-search').dispatchEvent(new Event('input')); } });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('#global-search').focus(); } if (e.key === 'Escape') { closeModal(); closeDetail(); } });
  document.querySelector('#add-student').addEventListener('click', () => openCreate());
  document.querySelector('#add-student-dashboard').addEventListener('click', () => openCreate());
  document.querySelectorAll('[data-close-modal]').forEach(x => x.addEventListener('click', closeModal));
  document.querySelectorAll('[data-close-detail]').forEach(x => x.addEventListener('click', closeDetail));
  document.querySelector('#student-form').addEventListener('submit', handleSaveStudent);
  document.querySelector('#detail-edit').addEventListener('click', () => { closeDetail(); if (detailId) openEdit(detailId); });
}

function enterApp(user) {
  currentUser = user;
  document.querySelector('#login-screen').classList.add('hidden');
  document.querySelector('#app-shell').classList.remove('hidden');
  document.querySelector('#hello-name').textContent = user.displayName?.split(' ').slice(-2).join(' ') || 'bạn';
  document.querySelector('#user-name').textContent = user.displayName || 'Administrator';
  document.querySelector('#user-role').textContent = user.role || 'Administrator';
  document.querySelector('#user-avatar').textContent = (user.displayName || 'AD').split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase();
  document.querySelector('#dark-toggle').checked = storage.theme === 'dark';
  document.querySelector('#api-status').textContent = 'Đang kiểm tra máy chủ…';
  api.get('/api/health').then(() => { document.querySelector('#api-status').textContent = 'Đã kết nối máy chủ'; }).catch(() => { document.querySelector('#api-status').textContent = 'Máy chủ không phản hồi'; });
  initStudents({ toast, onError, reloadDashboard: () => loadDashboard().catch(onError), openDetail, openEdit }).catch(onError);
  loadDashboard().catch(onError);
}

function showLogin() {
  document.querySelector('#app-shell').classList.add('hidden');
  document.querySelector('#login-screen').classList.remove('hidden');
  document.querySelector('#login-error').classList.add('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  try {
    const result = await api.login({ email: document.querySelector('#login-email').value.trim(), password: document.querySelector('#login-password').value, remember: document.querySelector('#remember-me').checked });
    enterApp(result.user);
  } catch (err) {
    const error = document.querySelector('#login-error'); error.textContent = err.message; error.classList.remove('hidden');
  } finally { button.disabled = false; }
}

function navigate(view) {
  if (!views[view]) return;
  document.querySelectorAll('.page').forEach(x => x.classList.add('hidden'));
  document.querySelector(`#view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x.dataset.view === view));
  document.querySelector('#breadcrumb').textContent = views[view];
  document.querySelector('#sidebar').classList.remove('open');
  if (view === 'dashboard') loadDashboard().catch(onError);
  if (view === 'students') loadStudents().catch(onError);
  if (view === 'audit') loadAudit().catch(onError);
}

async function loadAudit(page = 1) {
  const data = await api.get(`/api/audit?page=${page}&pageSize=15`);
  document.querySelector('#audit-rows').innerHTML = data.items.map(x => `<tr><td>${formatDateTime(x.createdAt)}</td><td>${escapeHtml(x.performedBy)}</td><td><span class="action-chip">${escapeHtml(x.action)}</span></td><td>${escapeHtml(x.entity)} #${escapeHtml(x.entityId)}</td><td>${escapeHtml(x.details)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-cell">Chưa có nhật ký.</td></tr>';
  document.querySelector('#audit-label').textContent = `${data.pagination.total} sự kiện`;
  const root = document.querySelector('#audit-pagination'); root.innerHTML = [1].filter(() => data.pagination.totalPages > 1).map(() => `<button class="page-btn active">${page}</button>`).join('');
}

function openCreate() {
  document.querySelector('#modal-title').textContent = 'Thêm sinh viên';
  document.querySelector('#student-form').reset();
  document.querySelector('#student-id').value = '';
  document.querySelector('#student-status').value = 'Active';
  document.querySelector('#student-gender').value = 'Female';
  document.querySelector('#student-gpa').value = '3.00';
  document.querySelector('#student-modal').classList.remove('hidden');
  setTimeout(() => document.querySelector('#full-name').focus(), 50);
}

async function openEdit(id) {
  try {
    await fillForm(id);
    document.querySelector('#modal-title').textContent = 'Cập nhật sinh viên';
    document.querySelector('#student-modal').classList.remove('hidden');
    document.querySelector('#full-name').focus();
  } catch (err) { onError(err); }
}

async function openDetail(id) {
  try { detailId = id; await buildDetail(id); document.querySelector('#student-detail-modal').classList.remove('hidden'); }
  catch (err) { onError(err); }
}

async function handleSaveStudent(e) {
  e.preventDefault();
  const button = document.querySelector('#save-student-btn');
  button.disabled = true;
  document.querySelector('#form-message').classList.add('hidden');
  try {
    const result = await saveForm();
    closeModal();
    toast(result.id ? 'Đã lưu hồ sơ sinh viên.' : 'Đã thêm sinh viên.');
    await loadStudents();
    await loadDashboard();
  } catch (err) {
    const box = document.querySelector('#form-message'); box.textContent = err.message; box.classList.remove('hidden');
  } finally { button.disabled = false; }
}

function refreshCurrentView() { const active = document.querySelector('.nav-link.active')?.dataset.view || 'dashboard'; navigate(active); toast('Đã làm mới dữ liệu.'); }
function closeModal() { document.querySelector('#student-modal').classList.add('hidden'); }
function closeDetail() { document.querySelector('#student-detail-modal').classList.add('hidden'); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme; storage.theme = theme; document.querySelector('#theme-btn').textContent = theme === 'dark' ? '☀' : '☼'; }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
function onError(error) { if (error?.status === 401) return showLogin(); toast(error?.message || 'Có lỗi xảy ra.'); }
function formatDateTime(v) { return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
