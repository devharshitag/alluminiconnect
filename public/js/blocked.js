// Blocked people: list and unblock
(function () {
  const list = document.getElementById('blist');
  if (!list) return;
  const msg = document.getElementById('bmsg');
  async function load() {
    try {
      const r = await api('/api/blocks');
      list.replaceChildren(...r.blocks.map((b) => {
        const c = el('div', 'req'); const h = el('div', 'mhead');
        h.append(el('strong', '', b.full_name + ' (' + b.role + ')'), el('span', 'hint', 'Blocked ' + b.blocked_on));
        const u = el('button', 'alt small', 'Unblock'); u.type = 'button';
        u.addEventListener('click', async () => {
          try { await api('/api/blocks/' + b.user_id, undefined, 'DELETE'); load(); } catch (err) { showMsg(msg, err.message, false); }
        });
        c.append(h, u); return c;
      }));
      document.getElementById('empty').classList.toggle('hidden', r.blocks.length > 0);
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else if (err.status === 403) location.href = 'dashboard.html'; else showMsg(msg, err.message, false);
    }
  }
  load();
})();
