// Verification page: upload a document and see the status of earlier submissions
(function () {
  const form = document.getElementById('upload-form');
  if (!form) return;
  const msg = form.querySelector('.msg');
  const typeSel = document.getElementById('document_type');
  const box = document.getElementById('status-box');
  const history = document.getElementById('history');
  const empty = document.getElementById('empty');
  const LABELS = { id_card: 'ID card', marksheet: 'Marksheet', degree_certificate: 'Degree certificate' };
  const OPTIONS = { student: ['id_card', 'marksheet'], senior: ['id_card', 'marksheet'], alumni: ['degree_certificate', 'marksheet', 'id_card'] };
  let me = null;

  function renderHistory(list) {
    history.replaceChildren();
    empty.classList.toggle('hidden', list.length > 0);
    list.forEach((r) => {
      const row = document.createElement('div'); row.className = 'req';
      const top = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = r.method === 'email_domain' ? 'University email' : (LABELS[r.document_type] || 'Document');
      const badge = document.createElement('span');
      badge.className = 'badge ' + r.status; badge.textContent = r.status[0].toUpperCase() + r.status.slice(1);
      badge.style.marginLeft = '8px';
      top.append(title, badge);
      const when = document.createElement('div'); when.className = 'hint';
      when.textContent = new Date(r.created_at).toLocaleString();
      row.append(top, when);
      if (r.remarks) { const n = document.createElement('div'); n.textContent = 'Admin note: ' + r.remarks; row.append(n); }
      if (r.method === 'document') {
        const a = document.createElement('a'); a.href = '/api/verification/' + r.verification_id + '/file';
        a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'View file'; row.append(a);
      }
      history.append(row);
    });
  }

  async function load() {
    me = await api('/api/auth/me');
    typeSel.replaceChildren();
    (OPTIONS[me.role] || []).forEach((t) => typeSel.add(new Option(LABELS[t], t)));
    const list = await api('/api/verification/mine');
    renderHistory(list);
    const pending = list.some((r) => r.method === 'document' && r.status === 'pending');
    const verified = me.verification_status === 'verified';
    form.classList.toggle('hidden', verified || pending || me.role === 'admin');
    box.classList.toggle('hidden', !(verified || pending));
    box.textContent = verified ? 'Your account is verified. Nothing more to do.'
      : 'Your document is waiting for review. You can upload another one after a decision.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('document').files[0];
    if (!file) return showMsg(msg, 'Choose a file first.', false);
    if (file.size > 5 * 1024 * 1024) return showMsg(msg, 'File is too large (maximum 5 MB).', false);
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const res = await fetch('/api/verification', { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      form.reset(); showMsg(msg, json.message, true); await load();
    } catch (err) { showMsg(msg, err.message, false); }
    finally { btn.disabled = false; }
  });

  load().catch(() => { location.href = 'login.html'; });
})();
