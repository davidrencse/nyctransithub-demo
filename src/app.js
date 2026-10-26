import { LINES, ROUTE_GROUPS, ROUTE_COLORS, DARK_TEXT_ROUTES, BOROUGHS, buildStations, sortRoutes, project } from './data/subway.js';
import { createTransitMap } from './gl/map.js';
import { loadAlerts, loadOutages, statusByRoute, STATUS_RANK } from './live.js';
import { LANGUAGES, t, tIn, setLang, getLang, initialLang, onLangChange } from './i18n.js';
import { initAuth, signIn, signUp, signInWithGoogle, signOut, usingFirebase } from './auth.js';
import { reviewsEnabled, stationReviews } from './reviews.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s = '') => s.toLowerCase().replace(/[–—]/g, '-').replace(/[^a-z0-9]/g, '');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALL_ROUTES = ROUTE_GROUPS.flatMap((g) => g.routes);

const state = {
  alerts: [], alertSource: 'live', alertsAt: 0, byRoute: {},
  outages: [], outageSource: 'live',
  statusFilter: 'all', kind: 'all', accessQuery: '', accessLimit: 12,
  user: null, selected: null,
};

// ---------- persistence (per signed-in user, or "guest")
const store = {
  key: () => `th.saved.${state.user?.uid || 'guest'}`,
  read() {
    try { return { stations: [], lines: [], prefs: { delays: true, planned: false, elevators: false }, ...JSON.parse(localStorage.getItem(this.key()) || '{}') }; }
    catch { return { stations: [], lines: [], prefs: { delays: true, planned: false, elevators: false } }; }
  },
  write(data) { try { localStorage.setItem(this.key(), JSON.stringify(data)); } catch {} },
};
let saved = store.read();
const saveSaved = () => { store.write(saved); renderSaved(); };

// ---------- small render helpers
function bullet(route, cls = '') {
  const dark = DARK_TEXT_ROUTES.has(route) ? ' dark-text' : '';
  return `<span class="bullet${dark} ${cls}" data-route="${esc(route)}" style="--c:${ROUTE_COLORS[route] || '#808183'}" aria-label="${esc(route)} train">${esc(route)}</span>`;
}
const bullets = (routes, cls) => `<span class="bullets">${routes.map((r) => bullet(r, cls)).join('')}</span>`;

// "[7] trains are delayed" → bullets inline
function alertHtml(text) {
  return esc(text).replace(/\[([^\]]+)\]/g, (_, tok) => {
    const r = tok.replace(/X$/, '');
    if (ROUTE_COLORS[r]) return bullet(r, 'inline-bullet');
    if (/accessibility/i.test(tok)) return '';
    return esc(tok.replace(/ icon$/i, ''));
  });
}
const plain = (text) => text.replace(/\[([^\]]+)\]/g, '$1');

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return t('time.now');
  if (m < 60) return t('time.min', { n: m });
  if (m < 48 * 60) return t('time.hr', { n: Math.round(m / 60) });
  return new Intl.DateTimeFormat(getLang() === 'zh' ? 'zh-Hans' : getLang(), { month: 'short', day: 'numeric' }).format(ms);
}
const fmtDate = (d) => d && !isNaN(d) ? new Intl.DateTimeFormat(getLang() === 'zh' ? 'zh-Hans' : getLang(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(d) : '—';

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2400);
}

const groupStatus = (g) => g.routes.reduce((worst, r) => {
  const s = state.byRoute[r]?.status || 'good';
  return STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst;
}, 'good');
const groupAlerts = (g) => [...new Map(g.routes.flatMap((r) => state.byRoute[r]?.alerts || []).map((a) => [a.id, a])).values()];
const isDisrupted = (s) => STATUS_RANK[s] >= STATUS_RANK.planned;

// ---------- map
const stations = buildStations();
let map = null;
try {
  const labels = BOROUGHS.map(([name, lat, lon]) => {
    const el = document.createElement('span');
    el.className = 'map-label';
    el.textContent = name;
    $('.map-stage').append(el);
    const [x, z] = project(lat, lon);
    return { el, x, z };
  });
  map = createTransitMap($('#gl'), {
    lines: LINES, stations, labels, reducedMotion,
    onHover(st, x, y) {
      const tip = $('#tooltip');
      if (!st) { tip.hidden = true; return; }
      tip.innerHTML = `<span>${esc(st.name)}</span>${bullets(st.routes)}`;
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
      tip.hidden = false;
    },
    onSelect: (st) => openStation(st),
  });
  new IntersectionObserver(([e]) => map.setActive(e.isIntersecting)).observe($('#map'));
} catch (err) {
  console.warn(err);
  $('#map-fallback').hidden = false;
  $('.map-tools').hidden = true;
}

let focusedGroup = null;
function focusGroup(id) {
  focusedGroup = focusedGroup === id ? null : id;
  map?.focusGroup(focusedGroup);
  $('#show-all').hidden = !focusedGroup;
  renderLegend();
}

function renderLegend() {
  $('#legend').innerHTML = ROUTE_GROUPS.filter((g) => g.id !== 'SI').map((g) => {
    const on = focusedGroup === g.id;
    const s = groupStatus(g);
    return `<li><button type="button" data-group="${g.id}" aria-pressed="${on}" class="${on ? 'is-color' : ''}">
      ${bullets(g.routes)}<span>${esc(g.name)}</span><span class="dot" data-status="${s}" title="${esc(t('status.' + s))}"></span></button></li>`;
  }).join('');
}
$('#legend').addEventListener('click', (e) => {
  const b = e.target.closest('[data-group]');
  if (b) focusGroup(b.dataset.group);
});
$('#show-all').addEventListener('click', () => focusGroup(null));
$('#zoom-in').addEventListener('click', () => map?.zoom(0.75));
$('#zoom-out').addEventListener('click', () => map?.zoom(1.33));

let hintTimer;
$('#gl').addEventListener('wheel', (e) => {
  if (!map) return;
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    map.zoom(Math.exp(e.deltaY * 0.004));
    return;
  }
  $('#map-hint').classList.add('is-on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $('#map-hint').classList.remove('is-on'), 1400);
}, { passive: false });

function outagesAt(st) {
  const n = norm(st.name.split(' / ')[0]);
  return state.outages.filter((o) => {
    const on = norm(o.station);
    return (on === n || on.startsWith(n) || n.startsWith(on)) && o.routes.some((r) => st.routes.includes(r));
  });
}

function openStation(st) {
  state.selected = st;
  const card = $('#station-card');
  const routeLines = st.routes.map((r) => ({ r, s: state.byRoute[r]?.status || 'good' }));
  const worst = routeLines.filter((x) => isDisrupted(x.s));
  const outs = outagesAt(st);
  const isSaved = saved.stations.includes(st.name);
  card.innerHTML = `
    <h3>${esc(st.name)}</h3>
    ${bullets(st.routes)}
    <button class="icon-btn" type="button" data-close aria-label="Close"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
    <ul>
      ${worst.length ? worst.map((x) => `<li><span class="dot" data-status="${x.s}"></span><span>${bullet(x.r, 'inline-bullet')} ${esc(t('status.' + x.s))}</span></li>`).join('')
        : `<li><span class="dot" data-status="good"></span><span>${esc(t('status.good'))}</span></li>`}
      ${outs.map((o) => `<li><span class="dot" data-status="delays"></span><span>${esc(o.serving)}</span></li>`).join('')}
    </ul>
    <button class="btn ${isSaved ? 'btn-ghost' : 'btn-light'} btn-sm" type="button" data-save>${esc(isSaved ? t('map.saved') : t('map.save'))}</button>
    ${reviewsEnabled ? `<section class="reviews" aria-live="polite"><p class="meta">${esc(t('reviews.loading'))}</p></section>` : ''}`;
  card.hidden = false;
  if (reviewsEnabled) loadReviews(st);
}

async function loadReviews(st) {
  const el = () => (state.selected === st ? $('#station-card .reviews') : null);
  try {
    const data = await stationReviews(st);
    if (!el()) return; // another station was opened meanwhile
    el().innerHTML = renderReviews(data);
  } catch (err) {
    console.warn('Reviews unavailable', err);
    if (el()) el().innerHTML = `<p class="meta">${esc(t('reviews.error'))}</p>`;
  }
}

function stars(n) {
  const full = Math.round(n || 0);
  return `<span class="stars" aria-label="${n} / 5">${'★'.repeat(full)}<span>${'★'.repeat(5 - full)}</span></span>`;
}

function renderReviews(data) {
  if (!data.reviews.length) return `<h4>${esc(t('reviews.title'))}</h4><p class="meta">${esc(t('reviews.none'))}</p>`;
  const signal = data.delayMentions
    ? `<p class="review-signal" data-on="true"><span class="dot" data-status="delays"></span>${esc(t('reviews.delays', { n: data.delayMentions, total: data.reviews.length }))}</p>`
    : `<p class="review-signal"><span class="dot" data-status="good"></span>${esc(t('reviews.noDelays', { total: data.reviews.length }))}</p>`;
  const body = (r) => {
    const text = esc(r.text.length > 220 ? r.text.slice(0, 220).trimEnd() + '…' : r.text);
    return r.delayWord ? text.replace(new RegExp(`\\b(${r.delayWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i'), '<mark>$1</mark>') : text;
  };
  return `
    <h4>${esc(t('reviews.title'))}${data.rating ? ` <span class="review-score">${data.rating.toFixed(1)} ${stars(data.rating)} <span class="meta">(${data.count.toLocaleString()})</span></span>` : ''}</h4>
    ${signal}
    <ol class="review-list">${data.reviews.slice(0, 3).map((r) => `
      <li>
        <div class="review-meta">${stars(r.rating)}<span>${r.authorUrl ? `<a href="${esc(r.authorUrl)}" target="_blank" rel="noopener">${esc(r.author)}</a>` : esc(r.author)}</span><span>${esc(r.when || '')}</span></div>
        <p>${body(r)}</p>
      </li>`).join('')}</ol>
    <p class="review-foot"><span>${esc(t('reviews.note'))}</span>${data.url ? ` <a href="${esc(data.url)}" target="_blank" rel="noopener">${esc(t('reviews.open'))}</a>` : ''}</p>
    <p class="google-attr">Google Maps</p>`;
}
$('#station-card').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { $('#station-card').hidden = true; state.selected = null; return; }
  if (e.target.closest('[data-save]') && state.selected) {
    toggleStation(state.selected.name);
    openStation(state.selected);
  }
});

function toggleStation(name) {
  const has = saved.stations.includes(name);
  saved.stations = has ? saved.stations.filter((s) => s !== name) : [...saved.stations, name];
  saveSaved();
  toast(has ? `${t('saved.remove')}: ${name}` : `${t('map.saved')}: ${name}`);
}

function showOnMap(st) {
  document.getElementById('map').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  if (focusedGroup && !st.lines.some((id) => LINES.find((l) => l.id === id).group === focusedGroup)) focusGroup(null);
  map?.flyTo(st);
  openStation(st);
}

// ---------- ticker
function renderTicker() {
  const items = state.alerts.filter((a) => isDisrupted(a.status)).slice(0, 14);
  const html = items.length
    ? items.map((a) => `<span class="ticker-item"><span class="ticker-type">${esc(t('status.' + a.status))}</span>${alertHtml(a.text)}</span>`).join('')
    : `<span class="ticker-item">${esc(t('status.noneDisrupted'))}</span>`;
  $('#ticker').innerHTML = html + html; // doubled for a seamless loop
  $('#ticker').style.animationDuration = `${Math.max(40, items.length * 14)}s`;
}

// ---------- status list
function renderStatus() {
  const good = ALL_ROUTES.filter((r) => !isDisrupted(state.byRoute[r]?.status || 'good')).length;
  $('#status-summary').textContent = t('status.summary', { n: good, total: ALL_ROUTES.length });
  $('#status-notice').hidden = state.alertSource !== 'sample';
  $('#status-notice').textContent = t('status.sample');
  const updated = state.alertsAt ? new Intl.DateTimeFormat(getLang(), { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(state.alertsAt) : '';
  $('#status-meta').textContent = `${t('status.updated', { time: updated })}. ${getLang() !== 'en' ? t('status.englishOnly') : ''}`;

  const openIds = new Set($$('.status-row[open]').map((d) => d.dataset.group));
  const groups = ROUTE_GROUPS.filter((g) => state.statusFilter === 'all' || isDisrupted(groupStatus(g)));
  if (!groups.length) {
    $('#status-list').innerHTML = `<p class="status-empty">${esc(t('status.noneDisrupted'))}</p>`;
    return;
  }
  $('#status-list').innerHTML = groups.map((g) => {
    const s = groupStatus(g);
    const alerts = groupAlerts(g).filter((a) => a.status !== 'notice' || s === 'notice');
    const lead = alerts[0];
    return `<details class="status-row ${alerts.length ? 'has-alerts' : ''}" data-group="${g.id}" ${openIds.has(g.id) && alerts.length ? 'open' : ''}>
      <summary>
        ${bullets(g.routes, 'bullet-lg')}
        <span class="name">${esc(g.name)}</span>
        <span class="state" data-status="${s}"><span class="dot" data-status="${s}"></span>${esc(t('status.' + s))}</span>
        <span class="gist">${lead ? esc(plain(lead.text)) : ''}</span>
        <span class="ago">${lead ? esc(ago(lead.updated)) : ''}</span>
        <svg class="chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      ${alerts.length ? `<div class="alerts">${alerts.map((a) => `
        <div class="alert">
          <div class="alert-meta"><span class="dot" data-status="${a.status}"></span><span>${esc(a.type)}</span><span>${esc(ago(a.updated))}</span></div>
          <div>${alertHtml(a.text)}</div>
          ${a.detail ? `<div class="alert-detail">${alertHtml(a.detail.slice(0, 600))}</div>` : ''}
        </div>`).join('')}</div>` : ''}
    </details>`;
  }).join('');
}
$('#status-list').addEventListener('click', (e) => {
  const row = e.target.closest('.status-row');
  if (row && !row.classList.contains('has-alerts') && e.target.closest('summary')) e.preventDefault();
});
$$('[data-status-filter]').forEach((b) => b.addEventListener('click', () => {
  state.statusFilter = b.dataset.statusFilter;
  $$('[data-status-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderStatus();
}));

// ---------- accessibility
function renderAccess() {
  const el = state.outages.filter((o) => o.kind === 'elevator').length;
  const es = state.outages.length - el;
  $('#access-summary').innerHTML = esc(t('access.summary', { e: '\u0001', s: '\u0002' }))
    .replace('\u0001', `<b>${el}</b>`).replace('\u0002', `<b>${es}</b>`);

  const q = norm(state.accessQuery);
  const rows = state.outages.filter((o) => (state.kind === 'all' || o.kind === state.kind)
    && (!q || norm(o.station).includes(q) || o.routes.some((r) => norm(r) === q)));
  const byStation = new Map();
  for (const o of rows) {
    const k = o.station;
    if (!byStation.has(k)) byStation.set(k, []);
    byStation.get(k).push(o);
  }
  const all = [...byStation.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const list = all.slice(0, state.accessLimit);
  $('#access-list').innerHTML = list.length ? list.map(([name, outs]) => `
    <article class="outage-station">
      <header><h3>${esc(name)}</h3>${bullets(sortRoutes([...new Set(outs.flatMap((o) => o.routes))].filter((r) => ROUTE_COLORS[r])))}</header>
      ${outs.map((o) => `<div class="outage">
        <span class="eq">${esc(o.id)}</span>
        <span class="serving">${esc(o.serving)}</span>
        <span class="when">${esc(o.reason || '')}${o.reason ? '. ' : ''}${esc(t('access.back', { when: fmtDate(o.back) }))}${o.ada ? `. <span class="ada">${esc(t('access.ada'))}</span>` : ''}</span>
      </div>`).join('')}
    </article>`).join('') : `<p class="access-empty">${esc(t('access.none'))}</p>`;
  const more = all.length - list.length;
  $('#access-more').hidden = more <= 0;
  $('#access-more').textContent = `+ ${more}`;
}
$('#access-filter').addEventListener('input', (e) => { state.accessQuery = e.target.value; state.accessLimit = 12; renderAccess(); });
$('#access-more').addEventListener('click', () => { state.accessLimit += 24; renderAccess(); });
$$('[data-kind]').forEach((b) => b.addEventListener('click', () => {
  state.kind = b.dataset.kind;
  $$('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderAccess();
}));

// ---------- saved stations, lines, notifications
function renderSaved() {
  $('#saved-sub').textContent = state.user ? state.user.email : t('saved.local');
  const items = saved.stations.map((name) => stations.find((s) => s.name === name)).filter(Boolean);
  $('#saved-list').innerHTML = items.length ? items.map((st) => {
    const worst = st.routes.map((r) => state.byRoute[r]?.status || 'good').sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0];
    const outs = outagesAt(st).length;
    return `<li>
      <button class="st-open" type="button" data-open="${esc(st.name)}">
        <div class="st-name">${esc(st.name)}</div>
        <div class="st-sub"><span class="dot" data-status="${worst}"></span>${esc(t('status.' + worst))}${outs ? ` <span aria-hidden="true">/</span> ${outs} ${esc(t('access.elevators').toLowerCase())}` : ''}</div>
      </button>
      ${bullets(st.routes)}
      <button class="text-btn" type="button" data-remove="${esc(st.name)}">${esc(t('saved.remove'))}</button>
    </li>`;
  }).join('') : `<li class="saved-empty">${esc(t('saved.empty'))}</li>`;

  $('#line-picker').innerHTML = ROUTE_GROUPS.flatMap((g) => g.routes).map((r) => {
    const on = saved.lines.includes(r);
    return `<button type="button" data-line="${r}" aria-pressed="${on}" class="${on ? 'is-color' : ''}">${bullet(r, 'bullet-lg')}</button>`;
  }).join('');

  $$('[data-pref]').forEach((i) => { i.checked = !!saved.prefs[i.dataset.pref]; });
  const perm = 'Notification' in window ? Notification.permission : 'denied';
  const wants = Object.values(saved.prefs).some(Boolean);
  $('#allow-notify').hidden = !(wants && perm === 'default');
  $('#notify-blocked').hidden = !(wants && perm === 'denied');
}
$('#saved-list').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) return toggleStation(rm.dataset.remove);
  const open = e.target.closest('[data-open]');
  if (open) showOnMap(stations.find((s) => s.name === open.dataset.open));
});
$('#line-picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-line]');
  if (!b) return;
  const r = b.dataset.line;
  saved.lines = saved.lines.includes(r) ? saved.lines.filter((x) => x !== r) : [...saved.lines, r];
  saveSaved();
});
$$('[data-pref]').forEach((i) => i.addEventListener('change', () => { saved.prefs[i.dataset.pref] = i.checked; saveSaved(); }));
$('#allow-notify').addEventListener('click', async () => { await Notification.requestPermission(); renderSaved(); });

// Notify when a saved line gets worse than it was on the previous refresh.
function notifyChanges(prev) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !prev) return;
  const mine = new Set([...saved.lines, ...saved.stations.flatMap((n) => stations.find((s) => s.name === n)?.routes || [])]);
  for (const r of mine) {
    const before = prev[r]?.status || 'good', now = state.byRoute[r]?.status || 'good';
    if (STATUS_RANK[now] <= STATUS_RANK[before]) continue;
    if ((now === 'delays' || now === 'suspended') && !saved.prefs.delays) continue;
    if ((now === 'planned' || now === 'changes') && !saved.prefs.planned) continue;
    if (now === 'notice') continue;
    const alert = state.byRoute[r].alerts[0];
    new Notification(`${r}: ${t('status.' + now)}`, { body: alert ? plain(alert.text) : '', tag: `th-${r}` });
  }
}

// ---------- languages
function renderLanguages() {
  const sel = $('#lang');
  sel.innerHTML = LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === getLang() ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  $('#lang-rows').innerHTML = LANGUAGES.map((l) => `<li><button type="button" lang="${l.code}" data-lang="${l.code}" aria-pressed="${l.code === getLang()}">
    <span class="phrase">${esc(tIn(l.code, 'lang.prompt'))}</span><span class="lang-name">${esc(l.name)}</span></button></li>`).join('');
}
$('#lang').addEventListener('change', (e) => setLang(e.target.value));
$('#lang-rows').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
onLangChange(() => { renderAll(); if (state.selected && !$('#station-card').hidden) openStation(state.selected); });

// ---------- search palette
const palette = $('#search'), input = $('#search-input');
let results = [], cursor = 0;
function openSearch() {
  if (palette.open) return;
  input.value = '';
  renderResults();
  palette.showModal();
  input.focus();
}
function renderResults() {
  const q = norm(input.value);
  const groups = ROUTE_GROUPS.filter((g) => !q || g.routes.some((r) => norm(r) === q) || norm(g.name).includes(q));
  const sts = stations.filter((s) => !q || norm(s.name).includes(q)).sort((a, b) => {
    const as = norm(a.name).startsWith(q) ? 0 : 1, bs = norm(b.name).startsWith(q) ? 0 : 1;
    return as - bs || b.routes.length - a.routes.length;
  }).slice(0, q ? 12 : 8);
  results = [...groups.slice(0, q ? 4 : 3).map((g) => ({ kind: 'group', g })), ...sts.map((s) => ({ kind: 'station', s }))];
  cursor = 0;
  if (!results.length) {
    $('#search-results').innerHTML = `<p class="palette-empty">${esc(t('search.empty', { q: input.value }))}</p>`;
    return;
  }
  let html = '', lastKind = '';
  results.forEach((r, i) => {
    if (r.kind !== lastKind) { html += `<div class="palette-group">${esc(t(r.kind === 'group' ? 'search.lines' : 'search.stations'))}</div>`; lastKind = r.kind; }
    html += r.kind === 'group'
      ? `<button type="button" class="palette-item" role="option" data-i="${i}" aria-selected="${i === cursor}"><span>${esc(r.g.name)}</span>${bullets(r.g.routes)}</button>`
      : `<button type="button" class="palette-item" role="option" data-i="${i}" aria-selected="${i === cursor}"><span>${esc(r.s.name)}</span>${bullets(r.s.routes)}</button>`;
  });
  $('#search-results').innerHTML = html;
}
function choose(i) {
  const r = results[i];
  if (!r) return;
  palette.close();
  if (r.kind === 'group') {
    document.getElementById('map').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    focusedGroup = null;
    focusGroup(r.g.id);
  } else showOnMap(r.s);
}
function moveCursor(d) {
  cursor = (cursor + d + results.length) % results.length;
  $$('.palette-item').forEach((el) => el.setAttribute('aria-selected', Number(el.dataset.i) === cursor));
  $(`.palette-item[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
}
input.addEventListener('input', renderResults);
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(cursor); }
});
$('#search-results').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) choose(Number(b.dataset.i)); });
palette.addEventListener('click', (e) => { if (e.target === palette) palette.close(); });
$$('[data-open-search]').forEach((b) => b.addEventListener('click', openSearch));
document.addEventListener('keydown', (e) => {
  const typing = /input|textarea|select/i.test(document.activeElement?.tagName);
  if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    openSearch();
  }
});

// ---------- auth
let authMode = 'signin';
function setAuthMode(mode) {
  authMode = mode;
  $('#auth-submit').dataset.i18n = mode === 'signin' ? 'auth.signin' : 'auth.signup';
  $('#auth-switch').dataset.i18n = mode === 'signin' ? 'auth.toSignup' : 'auth.toSignin';
  $('#auth-submit').textContent = t($('#auth-submit').dataset.i18n);
  $('#auth-switch').textContent = t($('#auth-switch').dataset.i18n);
  $('#auth-form').password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  $('#auth-error').hidden = true;
}
$('#account-btn').addEventListener('click', async () => {
  if (state.user) { await signOut(); toast(t('nav.signout')); return; }
  setAuthMode('signin');
  $('#auth-demo').hidden = usingFirebase;
  $('#auth').showModal();
});
$('#auth-close').addEventListener('click', () => $('#auth').close());
$('#auth-switch').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
async function runAuth(fn) {
  const err = $('#auth-error');
  err.hidden = true;
  $('#auth-submit').disabled = true;
  try { await fn(); $('#auth').close(); }
  catch (e) { err.textContent = e.message; err.hidden = false; }
  finally { $('#auth-submit').disabled = false; }
}
$('#auth-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const { email, password } = e.target;
  runAuth(() => (authMode === 'signin' ? signIn : signUp)(email.value.trim(), password.value));
});
$('#auth-google').addEventListener('click', () => runAuth(signInWithGoogle));

function onUser(user) {
  const guest = store.read();
  state.user = user;
  saved = store.read();
  // First sign-in on this device: carry over what the guest saved.
  if (user && !saved.stations.length && guest.stations.length && !state.user?.migrated) {
    saved = { ...guest };
    store.write(saved);
  }
  const btn = $('#account-btn');
  btn.dataset.i18n = user ? 'nav.signout' : 'nav.signin';
  btn.textContent = t(btn.dataset.i18n);
  btn.title = user?.email || '';
  renderSaved();
}

// ---------- data
async function refreshAlerts() {
  const prev = state.alertsAt ? state.byRoute : null;
  const res = await loadAlerts();
  state.alerts = res.alerts; state.alertSource = res.source; state.alertsAt = res.fetchedAt;
  state.byRoute = statusByRoute(res.alerts);
  map?.setDelayed(ROUTE_GROUPS.filter((g) => ['delays', 'suspended'].includes(groupStatus(g))).map((g) => g.id));
  renderTicker(); renderLegend(); renderStatus(); renderSaved();
  notifyChanges(prev);
}
async function refreshOutages() {
  const res = await loadOutages();
  state.outages = res.outages; state.outageSource = res.source;
  renderAccess(); renderSaved();
}
$('#refresh').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  b.disabled = true;
  await Promise.all([refreshAlerts(), refreshOutages()]);
  b.disabled = false;
  toast(t('status.updated', { time: t('time.now') }));
});

function renderAll() {
  renderLanguages(); renderLegend(); renderTicker(); renderStatus(); renderAccess(); renderSaved();
  $('#footer-mode').textContent = usingFirebase ? '' : t('auth.demo');
}

// ---------- nav background once the page scrolls, and the active tab
const nav = $('#nav');
addEventListener('scroll', () => nav.classList.toggle('is-solid', scrollY > 24), { passive: true });
const tabs = $$('.tabbar [data-tab]');
const tabObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    tabs.forEach((a) => a.setAttribute('aria-current', a.dataset.tab === e.target.id));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
['map', 'status', 'access', 'saved'].forEach((id) => tabObserver.observe(document.getElementById(id)));

// ---------- boot
setLang(initialLang());
renderAll();
initAuth(onUser).catch((e) => console.warn('Auth unavailable', e));
refreshAlerts();
refreshOutages();
setInterval(refreshAlerts, 60_000);
setInterval(refreshOutages, 5 * 60_000);
