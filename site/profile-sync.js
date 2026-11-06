/* Shared progress sync. Authentication cookies stay HttpOnly on cu.vubni.ru. */
(() => {
  'use strict';
  const isLocal = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const origin = isLocal ? (window.RyadomProfileApiOrigin || location.origin) : 'https://cu.vubni.ru';
  const adapter = () => window.RyadomProfileAdapter;
  // Native sign-in may delegate to its server's course-only canonical gateway.
  // Only learning keys use scoped storage; cookies/metadata/backups remain here.
  const progressStorage = () => adapter()?.storage || localStorage;
  const storageScope = () => adapter()?.storageScope?.() || 'local';
  let session = null, remote = null, busy = false, connected = false, epoch = 0, inspectQueued = false;
  let dialog, message, actions, trigger;
  const element = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
  const button = (text, action, primary = false) => { const el = element('button', text, primary ? 'rp-primary' : ''); el.type = 'button'; el.addEventListener('click', () => run(action)); return el; };
  const canonical = state => JSON.stringify(Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b))));
  const hash = async state => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(state))))).map(n => n.toString(16).padStart(2, '0')).join('');
  const ownerKey = () => 'ryadom-sync-owner-v1:' + adapter().project;
  const metaKey = (owner = session.user.id) => 'ryadom-sync-v1:' + owner + ':' + adapter().project;
  const pauseKey = () => 'ryadom-sync-paused-v1:' + adapter().project;
  const backupKey = () => 'ryadom-sync-backups-v1:' + adapter().project;
  const viewKey = () => 'ryadom-sync-view-v1:' + adapter().project;
  function keepReadingPosition() {
    try { window.sessionStorage?.setItem(viewKey(), JSON.stringify({ path: location.pathname, hash: location.hash, x: window.scrollX || 0, y: window.scrollY || 0, at: Date.now() })); } catch { /* Browser scroll restoration remains available. */ }
  }
  function restoreReadingPosition() {
    try {
      const raw = window.sessionStorage?.getItem(viewKey()); if (!raw) return;
      window.sessionStorage.removeItem(viewKey()); const value = JSON.parse(raw);
      if (value.path !== location.pathname || value.hash !== location.hash || !Number.isFinite(value.at) || Math.abs(Date.now() - value.at) > 600000 || ![value.x, value.y].every(n => Number.isFinite(n) && n >= 0 && n <= 10000000)) return;
      setTimeout(() => window.scrollTo({ top: value.y, left: value.x, behavior: 'instant' }), 100);
    } catch { /* Invalid or blocked session storage must not affect learning. */ }
  }
  async function request(path, data) {
    if (typeof adapter()?.transport === 'function') {
      if (path !== 'session' && path !== 'state/' + adapter().project) throw Error('Неизвестное действие предмета.');
      return adapter().transport(path, data);
    }
    const headers = { 'X-Ryadom-Request': '1' };
    if (data !== undefined) { headers['Content-Type'] = 'application/json'; if (session) headers['X-Ryadom-CSRF'] = session.csrf; }
    const response = await fetch(origin + '/api/profile/' + path, { method: data === undefined ? 'GET' : 'POST', headers, credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000), ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    const value = await response.json();
    if (!response.ok) { const error = Error(value.error || 'Не удалось связаться с профилем.'); error.status = response.status; throw error; }
    return value;
  }
  function adoptSession(next) {
    if (next?.user.id !== session?.user.id) { epoch++; connected = false; remote = null; }
    session = next;
  }
  function guard() { if (adapter()?.disabledReason) { connected = false; throw Error(adapter().disabledReason); } }
  function checkOwner(value) { if (value.userId !== session?.user.id) { connected = false; throw Error('Аккаунт изменился. Открой профиль ещё раз.'); } return value; }
  function snapshot() {
    guard(); const state = {};
    const storage = progressStorage();
    for (const key of adapter().keys) { const raw = storage.getItem(key); if (raw !== null) { JSON.parse(raw); state[key] = raw; } }
    adapter().validate?.(state); return state;
  }
  function validate(state) {
    guard();
    if (!state || typeof state !== 'object' || Array.isArray(state) || Object.keys(state).some(key => !adapter().keys.includes(key))) throw Error('Копия не подходит этому предмету.');
    for (const value of Object.values(state)) { if (typeof value !== 'string') throw Error('Повреждённая копия.'); JSON.parse(value); }
    if (new TextEncoder().encode(canonical(state)).length > 8 * 1024 * 1024) throw Error('Сохранение больше 8 МБ.');
    adapter().validate?.(state); return state;
  }
  function empty(state) { return Object.keys(state).length === 0 || adapter().isEmpty?.(state) === true; }
  async function capture() {
    const state = snapshot(), owner = localStorage.getItem(ownerKey()), account = session?.user.id, generation = epoch;
    const paused = localStorage.getItem(pauseKey()), binding = session ? localStorage.getItem(metaKey()) : null;
    const ownerBinding = owner ? localStorage.getItem(metaKey(owner)) : null, csrf = session?.csrf;
    const scope = storageScope();
    return { state, text: canonical(state), hash: await hash(state), owner, account, generation, paused, binding, ownerBinding, csrf, scope };
  }
  function assertBinding(start) {
    guard();
    if (start.scope !== storageScope()) throw Error('Способ входа изменился. Обе копии сохранены; открой профиль ещё раз.');
    if (start.generation !== epoch || start.account !== session?.user.id || start.owner !== localStorage.getItem(ownerKey())) throw Error('Профиль изменился. Открой его ещё раз.');
    if (start.paused !== localStorage.getItem(pauseKey()) || start.binding !== (session ? localStorage.getItem(metaKey()) : null)) throw Error('Синхронизация изменилась в другой вкладке. Прогресс этого устройства сохранён.');
    if (start.aliasAdoption && (start.csrf !== session?.csrf || start.ownerBinding !== localStorage.getItem(metaKey(start.owner)) || !verifiedAlias(start.owner))) throw Error('Подтверждение профиля изменилось. Исходные записи сохранены.');
  }
  function assertCurrent(start) {
    assertBinding(start);
    if (canonical(snapshot()) !== start.text) throw Error('Прогресс изменился на этом устройстве. Обе копии сохранены; открой профиль ещё раз.');
  }
  async function confirmAccount(start) {
    const current = await request('session'); adoptSession(current); assertCurrent(start);
  }
  function metadata() {
    if (!session || localStorage.getItem(ownerKey()) !== session.user.id) return null;
    return metadataFor(session.user.id);
  }
  function metadataFor(owner) {
    try { const value = JSON.parse(localStorage.getItem(metaKey(owner))); return value && (value.scope || 'local') === storageScope() && Number.isSafeInteger(value.revision) && value.revision >= 0 && /^[a-f0-9]{64}$/.test(value.hash) ? value : null; } catch { return null; }
  }
  function verifiedAlias(owner) {
    const id = /^[A-Za-z0-9_-]{1,128}$/;
    return typeof owner === 'string' && owner !== session?.user.id && id.test(owner)
      && Array.isArray(session?.canonicalAliases) && session.canonicalAliases.some(row => row
        && Object.keys(row).sort().join(',') === 'from,mergeId,to' && row.from === owner && row.to === session.user.id
        && typeof row.mergeId === 'string' && id.test(row.mergeId));
  }
  async function adoptAlias(start) {
    // Old metadata only identifies an unchanged local cache. Its revision must
    // never become the new canonical owner's write precondition.
    start = { ...start, aliasAdoption: true }; assertCurrent(start);
    await confirmAccount(start); assertCurrent(start);
    const fresh = checkOwner(await request('state/' + adapter().project));
    assertCurrent(start); validate(fresh.state);
    await applySnapshot(fresh.state, fresh.revision, start);
  }
  function remember(revision, fingerprint) {
    // Write binding last. A failed metadata write must never authorize another owner.
    localStorage.setItem(metaKey(), JSON.stringify({ revision, hash: fingerprint, scope: storageScope() }));
    localStorage.setItem(ownerKey(), session.user.id); connected = true;
  }
  function download(state) {
    const blob = new Blob([JSON.stringify({ app: 'ryadom-device-copy', schema: 1, project: adapter().project, savedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = 'ryadom-' + adapter().project + '-device-' + Date.now() + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function backups() {
    const raw = localStorage.getItem(backupKey());
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw Error('Не удалось прочитать резервные копии. Скачай копию устройства перед восстановлением.');
    return value;
  }
  function persistBackup(state) {
    const entry = { app: 'ryadom-device-copy', schema: 1, project: adapter().project, owner: localStorage.getItem(ownerKey()), savedAt: new Date().toISOString(), state };
    const history = [...backups(), entry].slice(-3);
    const encoded = JSON.stringify(history);
    // Bound retained history as well as its item count; quota failure aborts restore.
    if (new TextEncoder().encode(encoded).length > 24 * 1024 * 1024) throw Error('Не хватает места для резервной копии. Скачай прогресс устройства.');
    localStorage.setItem(backupKey(), encoded);
    if (localStorage.getItem(backupKey()) !== encoded) throw Error('Браузер не сохранил резервную копию. Прогресс не заменён.');
  }
  function status(text, attention = false) { if (!trigger) return; trigger.textContent = text === 'Войти' ? 'Войти' : 'Профиль'; trigger.title = text; trigger.dataset.attention = String(attention); trigger.setAttribute('aria-label', 'Профиль Рядом: ' + text); }
  function content(text, buttons = []) { message.textContent = text; actions.replaceChildren(...buttons); }
  function profileUrl() {
    // Never forward search parameters, auth fragments or arbitrary URLs from the page.
    const fragment = /^#(?:[\p{L}\p{N}_/-]+)?$/u.test(location.hash) ? location.hash : '';
    return origin + '/profile/?return=' + encodeURIComponent(location.origin + location.pathname + fragment);
  }
  function profileLink(label = 'Открыть профиль') { if(typeof adapter()?.openProfile==='function')return button(label,()=>adapter().openProfile());const link = element('a', label); link.href = profileUrl(); return link; }
  function extraLinks() {
    for (const item of adapter().profileLinks || []) {
      if (typeof item?.label !== 'string' || typeof item.href !== 'string') continue;
      // Native account links stay on the current subject; no arbitrary external URLs.
      try { const url = new URL(item.href, location.origin + location.pathname); if (url.origin !== location.origin || url.username || url.password || url.search) continue; const link = element('a', item.label); link.href = url.href; link.addEventListener('click', () => dialog.close()); actions.append(link); } catch {}
    }
  }
  async function run(action) {
    if (busy) return; busy = true;
    try { await action(); }
    catch (error) {
      connected = false;
      if (error.status === 401) adoptSession(null);
      content(['TimeoutError', 'TypeError'].includes(error.name) ? 'Нет связи с профилем. Прогресс остаётся на этом устройстве.' : error.message, [button('Повторить', inspect), button('Скачать копию устройства', () => download(snapshot()))]);
      status('Сохранено на устройстве', true);
    } finally { busy = false; if (inspectQueued) { inspectQueued = false; await run(inspect); } }
  }
  async function upload(start = null) {
    if(adapter()?.managedProfile)throw Error('Этот предмет сохраняет общий профиль через свой защищённый вход. Используй настройки прогресса предмета.');
    start ||= await capture(); assertCurrent(start);
    await confirmAccount(start); assertCurrent(start);
    try {
      const result = await request('state/' + adapter().project, { revision: remote.revision, state: start.state });
      // Keep subject releases compatible with the previous API during rollout.
      if (result.userId !== undefined) checkOwner(result); else await confirmAccount(start);
      try { assertBinding(start); } catch (error) { connected = false; status(error.message, true); return; }
      remember(result.revision, start.hash); localStorage.removeItem(pauseKey());
      remote = { ...result, state: start.state }; status('Сохранено');
      content('Прогресс сохраняется автоматически.', [button('Готово', () => dialog.close(), true)]);
    } catch (error) {
      if (error.status !== 409) throw error;
      remote = checkOwner(await request('state/' + adapter().project)); connected = false; choices('Копия в профиле изменилась. Выбери, какую продолжить.');
    }
  }
  async function restore() {
    const start = await capture();
    const fresh = checkOwner(await request('state/' + adapter().project));
    assertCurrent(start);
    if (fresh.revision !== remote.revision) { remote = fresh; choices('Копия в профиле обновилась. Выбери ещё раз.'); return; }
    await applySnapshot(fresh.state, fresh.revision, start);
  }
  async function applySnapshot(rawState, revision = null, start = null) {
    if(adapter()?.managedProfile)throw Error('Для загрузки копии используй настройки прогресса предмета. Исходные записи останутся доступны.');
    start ||= await capture(); const state = validate(rawState), fingerprint = await hash(state);
    if (revision !== null) await confirmAccount(start);
    assertCurrent(start);
    // Keep a durable copy BEFORE removing any existing key. Downloads may be blocked.
    persistBackup(start.state); assertCurrent(start);
    const key = session ? metaKey() : null, metadataBefore = key ? localStorage.getItem(key) : null;
    const ownerBefore = localStorage.getItem(ownerKey()), pauseBefore = localStorage.getItem(pauseKey());
    const storage = progressStorage();
    try {
      for (const key of adapter().keys) storage.removeItem(key);
      for (const [key, value] of Object.entries(state)) storage.setItem(key, value);
      assertBinding(start);
      if (start.aliasAdoption && canonical(snapshot()) !== canonical(state)) throw Error('Браузер не сохранил общие записи. Исходная копия сохранена.');
      if (revision !== null) { remember(revision, fingerprint); localStorage.removeItem(pauseKey()); }
      else { if (key) localStorage.removeItem(key); localStorage.removeItem(ownerKey()); localStorage.setItem(pauseKey(), '1'); connected = false; }
      if (start.aliasAdoption) { const saved = metadata(); if (!saved || saved.revision !== revision || saved.hash !== fingerprint) throw Error('Браузер не сохранил привязку. Исходная копия сохранена.'); }
    } catch {
      try {
        for (const key of adapter().keys) storage.removeItem(key);
        for (const [key, value] of Object.entries(start.state)) storage.setItem(key, value);
        if (ownerBefore === null) localStorage.removeItem(ownerKey()); else localStorage.setItem(ownerKey(), ownerBefore);
        if (key) { if (metadataBefore === null) localStorage.removeItem(key); else localStorage.setItem(key, metadataBefore); }
        if (pauseBefore === null) localStorage.removeItem(pauseKey()); else localStorage.setItem(pauseKey(), pauseBefore);
      } catch { throw Error('Браузер запретил запись. Прежний прогресс доступен в резервной копии этого устройства.'); }
      throw Error('Не хватило места в браузере. Прежний прогресс сохранён.');
    }
    keepReadingPosition(); location.reload();
  }
  function choices(prefix = '') {
    const hasCloud = remote?.revision > 0;
    content('Профиль: ' + session.user.username + '.\n\n' + (prefix ? prefix + '\n\n' : '') + (hasCloud ? 'На устройстве и в профиле разные сохранения. Выбери, с какого продолжить. Перед загрузкой сохраним резервную копию.' : 'В профиле пока нет сохранения этого предмета.'), [button(hasCloud ? 'Продолжить с этого устройства' : 'Сохранить прогресс в профиле', () => upload(), !hasCloud), ...(hasCloud ? [button('Загрузить из профиля', restore, true)] : []), button('Скачать копию устройства', () => download(snapshot()))]);
    status('Выбери сохранение', true);
  }
  async function reconcile() {
    if(adapter()?.managedProfile){connected=false;status('Профиль: '+adapter().managedProfile.username);return;}
    guard();
    const next = await request('session').catch(error => { if (error.status === 401) return null; throw error; }); adoptSession(next);
    if (!session) { connected = false; status('Войти'); return; }
    if (localStorage.getItem(pauseKey())) { connected = false; status('Синхронизация отключена'); return; }
    const start = await capture();
    remote = checkOwner(await request('state/' + adapter().project)); assertCurrent(start); validate(remote.state);
    const meta = metadata(), changedOwner = start.owner && start.owner !== session.user.id;
    if (changedOwner) {
      const previous = metadataFor(start.owner);
      if (verifiedAlias(start.owner) && (canonical(remote.state) === start.text || previous && previous.hash === start.hash)) { await adoptAlias(start); return; }
      connected = false; choices('На устройстве остался прогресс другого профиля. Он не отправлен в новый аккаунт.'); return;
    }
    if (canonical(remote.state) === start.text) { remember(remote.revision, start.hash); status('Сохранено'); return; }
    // An intentional local clear is an edit too. Never resurrect an older cloud copy.
    if (meta && start.hash !== meta.hash) {
      if (meta.revision === remote.revision) await upload(start);
      else { connected = false; choices(); }
      return;
    }
    if (remote.revision === 0) {
      if (empty(start.state)) { remember(0, start.hash); status('Сохранено'); }
      else await upload(start);
      return;
    }
    if (empty(start.state) || (meta && start.hash === meta.hash)) { await applySnapshot(remote.state, remote.revision, start); return; }
    connected = false; choices();
  }
  async function inspect() {
    if(adapter()?.managedProfile){const user=adapter().managedProfile;content('Профиль Рядом: '+user.username+'. Прогресс общий с учебными сайтами и подключённым ботом.',[profileLink('Открыть общий профиль'),button('Скачать копию устройства',()=>download(snapshot()))]);extraLinks();return;}
    if (adapter()?.disabledReason) { content(adapter().disabledReason, [profileLink()]); extraLinks(); return; }
    await reconcile();
    if (!session) { content('Один вход для учебных сайтов. Прогресс останется на устройстве и появится в профиле после входа.', [profileLink('Войти в Рядом')]); extraLinks(); return; }
    if (localStorage.getItem(pauseKey())) {
      content('Вошли как ' + session.user.username + '. Автоматическая синхронизация здесь отключена. Обе копии сохранены.', [button('Включить синхронизацию', async () => { localStorage.removeItem(pauseKey()); await inspect(); }, true)]);
    } else if (connected) {
      content('Вошли как ' + session.user.username + '. Прогресс сохраняется автоматически.', [button('Готово', () => dialog.close(), true), button('Отключить синхронизацию здесь', () => { localStorage.setItem(pauseKey(), '1'); epoch++; connected = false; status('Синхронизация отключена'); content('Синхронизация отключена. Прогресс на устройстве и в профиле сохранён.', [button('Готово', () => dialog.close(), true)]); })]);
    }
    actions.append(profileLink()); extraLinks();
  }
  async function poll() {
    if (busy || document.hidden || dialog?.open || adapter()?.disabledReason) return;
    await run(reconcile);
  }
  async function open() { if (!dialog) return; if (!dialog.open) dialog.showModal(); if (busy) { inspectQueued = true; return; } await run(inspect); }
  function start() {
    const mount = document.querySelector('[data-ryadom-profile]'); if (!mount || !adapter()) return;
    trigger = element('button', 'Профиль', 'rp-trigger'); trigger.type = 'button'; trigger.addEventListener('click', open); mount.append(trigger);
    dialog = element('dialog', '', 'rp-dialog');
    const heading = element('div', '', 'rp-heading'), title = element('h2', 'Профиль Рядом'); title.id = 'rp-title'; dialog.setAttribute('aria-labelledby', title.id);
    const close = button('×', () => dialog.close()); close.className = 'rp-close'; close.setAttribute('aria-label', 'Закрыть профиль'); heading.append(title, close);
    message = element('p', 'Проверяем профиль…'); message.setAttribute('role', 'status'); actions = element('div', '', 'rp-actions');
    const tools = element('details', '', 'rp-tools'), toolsTitle = element('summary', 'Копии на этом устройстве');
    const exportButton = button('Скачать текущую копию', () => download(snapshot()));
    const backupButton = button('Скачать копию до восстановления', () => { const saved = backups().at(-1); if (!saved) throw Error('На этом устройстве пока нет резервной копии.'); download(validate(saved.state)); });
    const importLabel = element('label', 'Восстановить из файла'), file = element('input'); file.type = 'file'; file.accept = '.json,application/json';
    file.addEventListener('change', () => run(async () => {
      const selected = file.files[0]; if (!selected) return;
      try {
        if (selected.size > 40 * 1024 * 1024) throw Error('Файл больше 40 МБ. Выбери копию этого предмета.');
        const value = JSON.parse(await selected.text());
        const state = value.app === 'ryadom-device-copy' && value.schema === 1 && value.project === adapter().project ? value.state : value.app === 'ryadom-profile' && value.schema === 1 ? value.courses?.[adapter().project]?.state : null;
        validate(state);
        content('Заменить прогресс устройства этой копией? Прежнюю сохраним отдельно. Синхронизация после импорта будет отключена.', [button('Восстановить эту копию', () => applySnapshot(state), true), button('Отмена', inspect)]);
      } finally { file.value = ''; }
    }));
    importLabel.append(file); tools.append(toolsTitle, exportButton, backupButton, importLabel); dialog.append(heading, message, actions, tools); document.body.append(dialog);
    window.RyadomProfile = Object.freeze({ open, refresh: () => run(reconcile) });
    document.addEventListener('click', event => { const target = event.target.closest?.('[data-ryadom-profile-open]'); if (target) { event.preventDefault(); open(); } });
    restoreReadingPosition(); run(reconcile); setInterval(poll, 5000);
    for (const event of ['online', 'focus', 'pageshow']) window.addEventListener(event, poll);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }
  let attempts = 0;
  const wait = setInterval(() => { if (adapter() && document.querySelector('[data-ryadom-profile]')) { clearInterval(wait); start(); } else if (++attempts >= 100) clearInterval(wait); }, 100);
})();
