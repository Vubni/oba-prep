/* Shared, non-sensitive appearance preference. No learning/account state is written. */
(() => {
  'use strict';
  if (window.RyadomTheme) return;
  const root = document.documentElement;
  if (!root) return;
  const key = 'ryadom-theme-v1';
  const cookieName = '__Secure-ryadom_theme';
  const modeName = '__Secure-ryadom_theme_mode';
  const domain = 'cu.vubni.ru';
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : {matches:false,addEventListener(){}};
  const sharedHost = location.protocol === 'https:' && (location.hostname === domain || location.hostname.endsWith('.' + domain));
  const valid = value => value === 'light' || value === 'dark';
  const validPreference = value => valid(value) || value === 'system';
  const systemTheme = () => media.matches ? 'dark' : 'light';
  let preference = 'system', theme = systemTheme(), initialized = false;
  function readCookie(name) {
    if (!sharedHost) return null;
    try {
      for (const item of document.cookie.split(';')) {
        const pair = item.trim().split('=');
        if (pair[0] === name) return pair.length === 2 ? pair[1] : null;
      }
    } catch { /* Storage restrictions leave the current page usable. */ }
    return null;
  }
  function read() {
    const shared = readCookie(cookieName);
    if (valid(shared)) return {preference: readCookie(modeName) === 'system' ? 'system' : shared, theme: shared};
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.version === 1 && validPreference(value.preference)) return {preference:value.preference, theme: valid(value.theme) ? value.theme : value.preference === 'system' ? systemTheme() : value.preference};
    } catch { /* Invalid or blocked storage is never copied to course progress. */ }
    return null;
  }
  function apply(next) {
    if (!next || !valid(next.theme) || !validPreference(next.preference)) return;
    const changed = theme !== next.theme || preference !== next.preference;
    preference = next.preference; theme = next.theme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#202426' : '#f8f7f3');
    if (changed) window.dispatchEvent(new CustomEvent('ryadom-theme', {detail:{theme,preference}}));
  }
  function persist() {
    try {
      const packed = JSON.stringify({version:1,preference,theme});
      if (localStorage.getItem(key) !== packed) localStorage.setItem(key,packed);
    } catch { /* A temporary in-memory setting is still useful. */ }
    if (sharedHost) {
      const tail = '; Domain=' + domain + '; Path=/; Max-Age=31536000; SameSite=Lax; Secure';
      try {
        document.cookie = modeName + '=' + (preference === 'system' ? 'system' : 'manual') + tail;
        document.cookie = cookieName + '=' + theme + tail;
      } catch { /* Never weaken cookie scope or security when storage is blocked. */ }
    }
  }
  function set(value) {
    if (!validPreference(value)) return false;
    initialized = true;
    apply({preference:value,theme:value === 'system' ? systemTheme() : value});
    persist();
    return true;
  }
  function refresh() {
    const next = read();
    if (!next) return;
    initialized = true;
    apply(next);
    // Mirror the authoritative shared cookie without triggering a storage loop.
    try {
      const packed=JSON.stringify({version:1,preference,theme});
      if (localStorage.getItem(key) !== packed) localStorage.setItem(key,packed);
    } catch {}
  }
  function migrate(value) {
    if (!initialized) set(validPreference(value) ? value : 'system');
    return theme;
  }
  const saved=read();
  if (saved) {initialized=true;apply(saved);persist();} else apply({preference,theme});
  Object.defineProperty(window,'RyadomTheme',{value:Object.freeze({get theme(){return theme;},get preference(){return preference;},set,refresh,migrate})});
  window.addEventListener('storage',event=>{if (event.key === key || event.key === null) refresh();});
  window.addEventListener('focus',refresh);
  window.addEventListener('pageshow',refresh);
  document.addEventListener('visibilitychange',()=>{if (document.visibilityState === 'visible') refresh();});
  media.addEventListener('change',()=>{if (preference === 'system') set('system');});
  const finish=()=>{if (!initialized) migrate('system');};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',finish,{once:true}); else finish();
})();
