const COOKIE_NAME = 'urban-style.scroll.v1';
// Scope the preference to this store, including GitHub Pages subdirectories.
const COOKIE_PATH = new URL('../', import.meta.url).pathname;

export function initScrollPreference(control) {
  let preference = 'smooth';
  try {
    const value = document.cookie.split(';').map(entry => entry.trim())
      .find(entry => entry.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (value === 'smooth' || value === 'instant') preference = value;
  } catch { /* With cookies blocked, the preference remains usable for this page. */ }

  const apply = () => {
    document.documentElement.dataset.scroll = control.checked ? 'smooth' : 'instant';
  };
  control.checked = preference === 'smooth';
  control.disabled = false;
  apply();
  control.addEventListener('change', () => {
    apply();
    try {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${COOKIE_NAME}=${document.documentElement.dataset.scroll}; Path=${COOKIE_PATH}; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch { /* No other storage is used as a substitute for this cookie. */ }
  });
}
