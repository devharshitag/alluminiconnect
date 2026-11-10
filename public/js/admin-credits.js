// Admin: search mentors, adjust credits, award Mentor of the Month
(function () {
  const list = document.getElementById('alist');
  if (!list) return;
  const msg = document.getElementById('amsg');
  const q = document.getElementById('q');

  async function search() {
    try {
      const r = await api('/api/credits/admin/mentors?q=' + encodeURIComponent(q.value.trim()));
      list.replaceChildren(...r.mentors.map((m) => {
        const c = el('div', 'req'); const h = el('div', 'mhead');
        h.append(el('strong', '', m.full_name + ' (' + m.role + ')'), el('span', 'badge open', m.credits + ' credits | ' + m.level));
        c.append(h, el('div', 'hint', m.email));
        const b = el('button', 'alt small', 'Adjust credits'); b.type = 'button';
        b.addEventListener('click', async () => {
          const delta = Number(prompt('Credits to add (use a minus sign to remove, -100 to 100):'));
          if (!Number.isInteger(delta) || delta === 0) return;
          const note = prompt('Reason (shown to the mentor):');
          if (!note) return;
          try { const x = await api('/api/credits/admin/adjust', { user_id: m.user_id, delta, note }); showMsg(msg, x.message, true); search(); }
          catch (err) { showMsg(msg, err.message, false); }
        });
        c.append(b); return c;
      }));
      if (!r.mentors.length) list.replaceChildren(el('p', 'hint', 'No mentors found.'));
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else if (err.status === 403) location.href = 'dashboard.html'; else showMsg(msg, err.message, false);
    }
  }
  document.getElementById('sform').addEventListener('submit', (e) => { e.preventDefault(); search(); });
  document.getElementById('mom').addEventListener('click', async () => {
    if (!confirm('Give the Mentor of the Month badge to this month\'s top earner?')) return;
    try { const r = await api('/api/credits/admin/mentor-of-month', {}); showMsg(msg, r.message, true); }
    catch (err) { showMsg(msg, err.message, false); }
  });
  search();
})();


(async function loadAuditLog() {
  const list = document.getElementById('audit-list');
  const status = document.getElementById('audit-status');
  if (!list || !status) return;

  try {
    const data = await api('/api/credits/admin/audit-logs');
    list.replaceChildren();

    if (!data.logs.length) {
      status.textContent = 'No audit records found.';
      return;
    }

    status.textContent = `${data.logs.length} recent record(s)`;

    data.logs.forEach(log => {
      const card = el('div', 'req');
      card.append(
        el('strong', '', log.action.replaceAll('_', ' ')),
        el('p', 'hint', `${log.created} | Admin: ${log.admin_name || 'Unknown'}`),
        el('p', '', `Entity: ${log.entity_type} #${log.entity_id}`),
     el(
  'p',
  'hint',
  typeof log.details === 'object'
    ? JSON.stringify(log.details)
    : log.details || ''
)
      );
      list.appendChild(card);
    });
  } catch (err) {
    status.textContent = err.status === 401 || err.status === 403
      ? 'Please log in as an admin to view audit records.'
      : 'Could not load the audit log.';
  }
})();
