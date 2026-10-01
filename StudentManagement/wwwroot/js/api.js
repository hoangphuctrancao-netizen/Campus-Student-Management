const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = body?.message || body?.title || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

export const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
  put: (url, body) => request(url, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }),
  del: (url) => request(url, { method: 'DELETE' }),
  login: (body) => request('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  importCsv: (file) => request('/api/students/import', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })() }),
  async download(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    const filename = match?.[1] || url.split('/').pop() || 'download.csv';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = decodeURIComponent(filename);
    link.click();
    URL.revokeObjectURL(link.href);
  }
};
