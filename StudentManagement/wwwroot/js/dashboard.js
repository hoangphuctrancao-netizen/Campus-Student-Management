import { api } from './api.js';

const STATUS = {
  Active: { label: 'Đang học', cls: 'green' },
  Pending: { label: 'Chờ xác nhận', cls: 'amber' },
  Leave: { label: 'Bảo lưu', cls: 'red' },
  Graduated: { label: 'Đã tốt nghiệp', cls: 'violet' }
};

const GENDER = { Male: 'Nam', Female: 'Nữ', Other: 'Khác' };

export async function loadDashboard() {
  const data = await api.get('/api/dashboard/summary');
  const { cards } = data;
  document.querySelector('#stat-total').textContent = cards.total.toLocaleString('vi-VN');
  document.querySelector('#stat-active').textContent = cards.active.toLocaleString('vi-VN');
  document.querySelector('#stat-pending').textContent = cards.pending.toLocaleString('vi-VN');
  document.querySelector('#stat-gpa').textContent = Number(cards.avgGpa).toFixed(2);
  document.querySelector('#active-rate').textContent = cards.total ? `${Math.round(cards.active / cards.total * 100)}% tổng số` : '0% tổng số';
  document.querySelector('#nav-student-count').textContent = cards.total.toLocaleString('vi-VN');

  renderMajorChart(data.majors);
  renderStatus(data.cards);
  renderRecent(data.recent);
  renderCohorts(data.cohorts);
}

function renderMajorChart(items) {
  const root = document.querySelector('#major-chart');
  const max = Math.max(1, ...items.map(x => x.count));
  root.innerHTML = items.map(item => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(item.name)}</span><strong>${item.count}</strong></div>
      <div class="bar-track"><i style="width:${Math.max(5, item.count / max * 100)}%"></i></div>
    </div>`).join('') || '<div class="empty-inline">Chưa có dữ liệu.</div>';
}

function renderStatus(cards) {
  const total = cards.total || 1;
  const pct = Math.round(cards.active / total * 100);
  document.querySelector('#donut-active').textContent = `${pct}%`;
  document.querySelector('#status-donut').style.setProperty('--pct', `${pct}%`);
  const entries = [['Active', cards.active], ['Pending', cards.pending], ['Leave', cards.leave], ['Graduated', cards.graduated]];
  document.querySelector('#status-legend').innerHTML = entries.map(([key, value]) => `<div><i class="legend-dot ${STATUS[key].cls}"></i><span>${STATUS[key].label}</span><strong>${value}</strong></div>`).join('');
}

function renderRecent(items) {
  document.querySelector('#recent-list').innerHTML = items.map(s => `
    <div class="recent-item"><div class="mini-avatar">${initials(s.fullName)}</div><div class="recent-copy"><strong>${escapeHtml(s.fullName)}</strong><span>${escapeHtml(s.major)} · ${escapeHtml(s.cohort)}</span></div><span class="gpa-chip">${Number(s.gpa).toFixed(2)}</span></div>`).join('') || '<div class="empty-inline">Chưa có hồ sơ.</div>';
}

function renderCohorts(items) {
  const max = Math.max(1, ...items.map(x => x.count));
  document.querySelector('#cohort-list').innerHTML = items.map(item => `<div class="cohort-row"><span>${escapeHtml(item.name)}</span><div><i style="width:${item.count / max * 100}%"></i></div><strong>${item.count}</strong></div>`).join('') || '<div class="empty-inline">Chưa có dữ liệu.</div>';
}

function initials(name) { return String(name).trim().split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
export { STATUS, GENDER, initials, escapeHtml };
