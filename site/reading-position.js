/* Quiet, local reading places. No completion, authentication or progress writes. */
(() => {
 'use strict';
 const valid = value => value && value.v === 1 && typeof value.route === 'string' && /^#[a-zA-Z0-9_/-]{1,180}$/.test(value.route) && typeof value.anchor === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value.anchor) && Number.isInteger(value.index) && value.index >= 0 && value.index < 5000 && Number.isFinite(value.offset) && value.offset >= 0 && value.offset <= 1 && Number.isFinite(value.progress) && value.progress >= 0 && value.progress <= 1 && typeof value.title === 'string' && value.title.length <= 160 && typeof value.label === 'string' && value.label.length <= 160 && Number.isSafeInteger(value.at) && value.at > 0;
 function create(config) {
  const main = config.main, memory = new Map(), dismissed = new Set();
  let current = null, bar = null, timer, restoreTimer, historyTimer, pending = null, engaged = false, lastScroll = 0;
  const now = () => Date.now(), scope = () => { try { return config.scope(); } catch { return null; } };
  const routeOf = () => config.currentRoute ? config.currentRoute() : location.hash;
  const storageKey = owner => config.key + ':' + encodeURIComponent(owner);
  const usable = point => valid(point) && (!config.acceptRoute || config.acceptRoute(point.route)) && now() - point.at < 90 * 86400000 && point.at <= now() + 60000;
  function read(owner) {
   if (!owner) return [];
   try { const raw = localStorage.getItem(storageKey(owner)); if (raw && raw.length > 160000) return []; const list = JSON.parse(raw || '[]'); if (!Array.isArray(list)) return []; const records = list.filter(usable).slice(0,100); const combined = [...records,...(memory.get(owner) || [])].filter(usable).sort((a,b) => b.at-a.at); const seen = new Set(); const merged = combined.filter(point => { if (seen.has(point.route)) return false; seen.add(point.route); return true; }).slice(0,100); memory.set(owner,merged); return merged; } catch { return (memory.get(owner) || []).filter(usable); }
  }
  const line = () => Math.min(innerHeight * .45, Math.max((config.header?.()?.getBoundingClientRect().bottom || 0) + 24, innerHeight * .2));
  const fingerprint = text => { let hash = 2166136261; for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0),16777619); return (hash >>> 0).toString(36); };
  function anchors(root) {
   const count = new Map(); let heading = (root.querySelector('h1')?.textContent || '').trim();
   const cleanText = el => { const copy = el.cloneNode(true); copy.querySelectorAll('annotation,.katex-mathml,script,style').forEach(node => node.remove()); return (copy.textContent || '').replace(/\s+/g,' ').trim(); };
   return [...root.querySelectorAll('h2,h3,p,li,figure,table,section[id],details[id]')].filter(el => !el.closest('nav,.reading-return,video,.lesson-videos,.lesson-video,form,.python-playground,.python-code,.code-widget,.editor,.terminal,.run-output,.note,[data-no-reading-position]') && !el.closest('details:not([open])') && el.getBoundingClientRect().height > 0).map((el,index) => {
    const text = cleanText(el); if (el.matches('h2,h3')) heading = text; else if (el.matches('section[id]') && el.querySelector('h2,h3')) heading = cleanText(el.querySelector('h2,h3')); const base = el.id && /^[a-zA-Z0-9_-]{1,110}$/.test(el.id) ? 'id-'+el.id : 't-'+fingerprint(el.tagName+':'+text); const ordinal = count.get(base) || 0; count.set(base,ordinal+1);
    return {el,index,key:base+'-'+ordinal,label:(heading || text).slice(0,160)};
   });
  }
  function capture(session = false) {
   if (!current?.root?.isConnected || scope() !== current.owner || routeOf() !== current.route) return null;
   if (scrollY < 120) return session ? {v:1,route:current.route,anchor:'viewport-start',index:0,offset:0,progress:0,title:current.title.slice(0,160),label:'Начало',at:now()} : null;
   const list = anchors(current.root), y = line(); if (!list.length) return null;
   // Prefer a paragraph over a large section containing that paragraph.
   let chosen = list.filter(a => { const r = a.el.getBoundingClientRect(); return r.top <= y && r.bottom > y; }).sort((a,b) => a.el.getBoundingClientRect().height-b.el.getBoundingClientRect().height)[0];
   if (!chosen) chosen = [...list].reverse().find(a => a.el.getBoundingClientRect().top <= y) || list[0];
   const r = chosen.el.getBoundingClientRect(), max = Math.max(1,document.documentElement.scrollHeight-innerHeight);
   return {v:1,route:current.route,anchor:chosen.key,index:chosen.index,offset:Math.max(0,Math.min(1,(y-r.top)/r.height)),progress:Math.min(1,scrollY/max),title:current.title.slice(0,160),label:chosen.label,at:now()};
  }
  function save() {
   if (!engaged || !document.hasFocus() || document.visibilityState !== 'visible' || document.querySelector('dialog[open]') || document.activeElement?.matches('input,textarea,[contenteditable="true"]')) return;
   const point = capture(); if (!point) return;
   const owner = current.owner, list = read(owner), previous = list.find(p => p.route === point.route);
   // Never overwrite a newer cross-tab stop with a dwell that began earlier.
   if (previous && previous.at > lastScroll) return;
   if (previous && previous.anchor === point.anchor && Math.abs(previous.offset-point.offset) < .1 && now()-previous.at < 15000) return;
   const next = [point,...list.filter(p => p.route !== point.route)].slice(0,100); memory.set(owner,next);
   try { if (owner !== scope()) return; localStorage.setItem(storageKey(owner),JSON.stringify(next)); } catch { /* Session-memory fallback; course progress is untouched. */ }
   try { history.replaceState({...history.state,readingPlace:{owner,point}},'',location.href); } catch { /* Browser history remains usable. */ }
  }
  function disarm() { engaged = false; clearTimeout(timer); clearTimeout(restoreTimer); clearTimeout(historyTimer); }
  function arm() { if (!current?.root || document.querySelector('dialog[open]')) return; pending = null; engaged = true; lastScroll = now(); clearTimeout(timer); timer = setTimeout(save,4000); }
  function scroll() { clearTimeout(historyTimer); historyTimer = setTimeout(() => { if (pending) return; const point = capture(true); if (point) { try { history.replaceState({...history.state,readingPlace:{owner:current.owner,point}},'',location.href); } catch {} } },250); if (!engaged) return; lastScroll = now(); clearTimeout(timer); timer = setTimeout(save,4000); }
  function removeBar() { bar?.remove(); bar = null; }
  function restore(point,owner,focus = false) {
   if (!valid(point) || scope() !== owner || current?.route !== point.route || !current.root?.isConnected) return;
   disarm(); removeBar(); const list = anchors(current.root), anchor = list.find(a => a.key === point.anchor);
   const max = Math.max(0,document.documentElement.scrollHeight-innerHeight);
   const top = anchor ? scrollY+anchor.el.getBoundingClientRect().top+point.offset*anchor.el.getBoundingClientRect().height-line() : point.progress*max;
   window.scrollTo({top:Math.max(0,Math.min(max,top)),behavior:'instant'});
   if (focus && anchor) { if (!anchor.el.hasAttribute('tabindex')) anchor.el.setAttribute('tabindex','-1'); anchor.el.focus({preventScroll:true}); }
   try { history.replaceState({...history.state,readingPlace:{owner,point}},'',location.href); } catch {}
   removeBar(); pending = null;
  }
  function offer(point,owner) {
   if (!point || dismissed.has(owner+point.route) || point.progress < .015) return;
   bar = document.createElement('aside'); bar.className = 'reading-return'; bar.setAttribute('aria-label','Сохранённое место чтения');
   const copy = document.createElement('span'); copy.textContent = current.root ? 'Место чтения: '+(point.label || point.title).slice(0,85) : 'Продолжить: '+point.title;
   const go = document.createElement('button'); go.type = 'button'; go.className = 'text-button'; go.textContent = 'К месту чтения';
   go.onclick = () => { if (scope() !== owner) { mount(true); return; } if (routeOf() === point.route) restore(point,owner,true); else { pending = {point,owner,focus:true}; location.hash = point.route; } };
   const close = document.createElement('button'); close.type = 'button'; close.className = 'reading-return-close'; close.setAttribute('aria-label','Скрыть предложение вернуться'); close.textContent = '×'; close.onclick = () => { dismissed.add(owner+point.route); removeBar(); };
   bar.append(copy,go,close); main.prepend(bar);
  }
  function mount(force = false) {
   const owner = scope(), context = config.context(), root = context?.root || null, route = context?.route || routeOf();
   if (!force && current?.owner === owner && current?.root === root && current?.route === route && (!bar || bar.isConnected)) return;
   disarm(); removeBar(); current = {owner,root,route,title:context?.title || ''};
   if (!owner) return;
   const point = read(owner).find(p => root ? p.route === route : true);
   if (pending?.owner === owner && pending.point.route === route && root) {
    const expected = pending;
    restoreTimer = setTimeout(() => { if (pending === expected) restore(expected.point,owner,expected.focus); },120);
   } else { if (pending && pending.owner !== owner) pending = null; if (root || config.offerOnHome()) offer(point,owner); }
  }
  const observer = new MutationObserver(() => mount()); observer.observe(main,{childList:true,subtree:true});
  window.addEventListener('scroll',scroll,{passive:true}); window.addEventListener('wheel',arm,{passive:true}); window.addEventListener('touchmove',arm,{passive:true});
  document.addEventListener('keydown',event => { if (event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { pending=null; disarm(); return; } if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) arm(); });
  document.addEventListener('pointerdown',event => { if (event.clientX >= innerWidth-20) arm(); });
  document.addEventListener('click',event => { if (event.target.closest?.('a,button,summary') && !event.target.closest('.reading-return')) { const point = capture(true); if (point) { try { history.replaceState({...history.state,readingPlace:{owner:current.owner,point}},'',location.href); } catch {} } pending=null; disarm(); } },true);
  window.addEventListener('popstate',event => {
   disarm();
   // Hash navigation also emits popstate. Keep an explicit return queued by its button.
   if (!(pending?.focus && pending.owner === scope() && pending.point.route === routeOf())) {
    const saved = event.state?.readingPlace;
    pending = saved?.owner === scope() && valid(saved.point) && saved.point.route === routeOf() ? saved : null;
   }
   mount(true);
  });
  window.addEventListener('hashchange',() => mount());
  window.addEventListener('blur',disarm);
  window.addEventListener('focus',() => { if (current?.owner !== scope()) mount(true); });
  window.addEventListener('storage',() => mount(true));
  document.addEventListener('visibilitychange',() => { if (document.visibilityState !== 'visible') disarm(); });
  mount();
  return {refresh:() => mount(true)};
 }
 window.RyadomReadingPosition = {create,valid};
})();
