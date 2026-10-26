// MTA public feeds (no API key, CORS-enabled). Falls back to a small sample
// when the network or the feed is unavailable, and says so in `source`.

const ALERTS_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json';
const OUTAGES_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fnyct_ene.json';

export const STATUS_RANK = { good: 0, notice: 1, planned: 2, changes: 3, delays: 4, suspended: 5 };

function classify(type = '') {
  const t = type.toLowerCase();
  if (t.startsWith('planned')) return 'planned';
  if (t.includes('suspend')) return 'suspended';
  if (t.includes('delay')) return 'delays';
  if (/reroute|skip|express|local|detour/.test(t)) return 'changes';
  return 'notice';
}

// Feed route ids → the route bullets the app shows.
function normalizeRoute(id) {
  if (['GS', 'FS', 'H'].includes(id)) return 'S';
  if (id === 'SIR') return 'SI';
  return id.replace(/X$/, '');
}

function isActive(alert, now) {
  const periods = alert.active_period || [];
  if (!periods.length) return true;
  return periods.some((p) => (p.start || 0) <= now && (!p.end || p.end >= now));
}

export function parseAlerts(feed) {
  const now = Date.now() / 1000;
  const alerts = [];
  for (const entity of feed.entity || []) {
    const a = entity.alert;
    if (!a || !isActive(a, now)) continue;
    const meta = a['transit_realtime.mercury_alert'] || {};
    const routes = [...new Set((a.informed_entity || []).filter((e) => e.route_id).map((e) => normalizeRoute(e.route_id)))];
    if (!routes.length) continue;
    const text = (a.header_text?.translation || []).find((t) => t.language === 'en')?.text || '';
    const detail = (a.description_text?.translation || []).find((t) => t.language === 'en')?.text || '';
    alerts.push({
      id: entity.id,
      routes,
      type: meta.alert_type || 'Notice',
      status: classify(meta.alert_type),
      text: text.trim(),
      detail: detail.trim(),
      updated: (meta.updated_at || meta.created_at || now) * 1000,
    });
  }
  alerts.sort((x, y) => STATUS_RANK[y.status] - STATUS_RANK[x.status] || y.updated - x.updated);
  return alerts;
}

export function statusByRoute(alerts) {
  const out = {};
  for (const al of alerts) {
    for (const r of al.routes) {
      const cur = out[r] || { status: 'good', alerts: [] };
      cur.alerts.push(al);
      if (STATUS_RANK[al.status] > STATUS_RANK[cur.status]) cur.status = al.status;
      out[r] = cur;
    }
  }
  return out;
}

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadAlerts() {
  try {
    return { alerts: parseAlerts(await getJson(ALERTS_URL)), source: 'live', fetchedAt: Date.now() };
  } catch (err) {
    console.warn('Service alerts unavailable, showing sample data', err);
    return { alerts: SAMPLE_ALERTS(), source: 'sample', fetchedAt: Date.now() };
  }
}

const parseMtaDate = (s) => (s ? new Date(s.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')) : null);

export async function loadOutages() {
  let rows, source = 'live';
  try {
    rows = await getJson(OUTAGES_URL);
  } catch (err) {
    console.warn('Elevator data unavailable, showing sample data', err);
    rows = SAMPLE_OUTAGES;
    source = 'sample';
  }
  const outages = rows
    .filter((r) => r.isupcomingoutage !== 'Y')
    .map((r) => ({
      station: r.station,
      routes: (r.trainno || '').split('/').map((s) => s.trim()).filter(Boolean),
      id: r.equipment,
      kind: r.equipmenttype === 'ES' ? 'escalator' : 'elevator',
      serving: r.serving,
      ada: r.ADA === 'Y',
      reason: r.reason,
      since: parseMtaDate(r.outagedate),
      back: parseMtaDate(r.estimatedreturntoservice),
    }));
  return { outages, source, fetchedAt: Date.now() };
}

const SAMPLE_ALERTS = () => {
  const now = Date.now();
  return [
    { id: 's1', routes: ['7'], type: 'Delays', status: 'delays', text: 'Flushing-Main St-bound [7] trains are running with delays after we addressed a signal problem at Junction Blvd.', detail: '', updated: now - 6 * 60e3 },
    { id: 's2', routes: ['F', 'G'], type: 'Planned - Stops Skipped', status: 'planned', text: 'Coney Island-bound [F][G] trains skip 4 Av-9 St.', detail: '', updated: now - 3 * 3600e3 },
    { id: 's3', routes: ['A'], type: 'Reroute', status: 'changes', text: 'Some Far Rockaway-bound [A] trains are running via the [F] from W 4 St to Jay St-MetroTech.', detail: '', updated: now - 18 * 60e3 },
  ];
};

const SAMPLE_OUTAGES = [
  { station: 'Grand Central-42 St', trainno: '4/5/6/7/S', equipment: 'EL225', equipmenttype: 'EL', serving: 'Street to mezzanine', ADA: 'Y', outagedate: '10/26/2026 06:00:00 AM', estimatedreturntoservice: '10/27/2026 11:00:00 PM', reason: 'Repair', isupcomingoutage: 'N' },
  { station: 'Jay St-MetroTech', trainno: 'A/C/F/R', equipment: 'ES419', equipmenttype: 'ES', serving: 'Mezzanine to Manhattan-bound platform', ADA: 'N', outagedate: '10/25/2026 02:00:00 PM', estimatedreturntoservice: '10/28/2026 05:00:00 PM', reason: 'Capital Replacement', isupcomingoutage: 'N' },
];
