// Demo mode: answers the dashboard's n8n webhook calls from bundled sample data,
// so the UI can run as a static site (e.g. GitHub Pages) without n8n or real servers.
const BASE = `${import.meta.env.BASE_URL}demo-data/`;
let indexPromise;
const loadIndex = () => (indexPromise ||= fetch(`${BASE}index.json`).then((r) => r.json()));
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

export function installMockFetch() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url);
    if (!/\/(list-files|get-file|download-file|refresh)(\?|$)/.test(url)) return realFetch(input, init);
    const q = new URL(url, window.location.href).searchParams;
    const app = q.get('app') || '';
    const table = (q.get('table') || '').toLowerCase();
    const file = q.get('filename') || q.get('file') || '';
    await new Promise((r) => setTimeout(r, 120)); // feel like a network call
    if (url.includes('/refresh')) return json({ success: true, demo: true });
    const index = await loadIndex();
    const files = index[app]?.[table] || [];
    if (url.includes('/list-files')) return json({ files });
    const name = file.split('/').pop();
    if (!files.includes(name)) return json([]);
    const res = await realFetch(`${BASE}${encodeURIComponent(app)}/${table}/${encodeURIComponent(name)}`);
    if (url.includes('/download-file') && q.get('type') === 'raw') {
      return new Response('Raw command output is not included in the public demo.', { status: 200 });
    }
    return res;
  };
}

export function showDemoBadge() {
  const add = () => {
    const a = document.createElement('a');
    a.href = 'https://skez.codes';
    a.textContent = 'Demo · anonymized sample data · back to skez.codes';
    Object.assign(a.style, {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: 9999, font: '600 12px system-ui, sans-serif',
      background: '#1d2430', color: '#f0a443', padding: '7px 11px', borderRadius: '6px', textDecoration: 'none',
      boxShadow: '0 4px 14px rgba(0,0,0,.2)',
    });
    document.body.appendChild(a);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
}
