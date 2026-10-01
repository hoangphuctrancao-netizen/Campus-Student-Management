const KEY = 'campus_ui_preferences';

function getPreferences() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

export const storage = {
  get theme() { return getPreferences().theme || 'light'; },
  set theme(value) {
    const data = getPreferences();
    data.theme = value;
    localStorage.setItem(KEY, JSON.stringify(data));
  }
};
