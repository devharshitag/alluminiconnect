// Notification centre
(function () {
  const list = document.getElementById('nlist');
  if (!list) return;
  const msg = document.getElementById('nmsg');
  let page = 1; let pages = 0; let unreadOnly = false;
  const SAFE_LINK = /^[a-z0-9-]+\.html(\?[a-zA-Z0-9=&_-]*)?$/;   // only pages of this site, never javascript: or other sites

  async function open(n) {
    if (!n.is_read) { try { await api('/api/notifications/' + n.id + '/read', {}); } catch (e) {} }
    if (n.link && SAFE_LINK.test(n.link)) location.href = n.link; else load();
  }

  function card(n) {
    const c = el('div', 'pcard' + (n.is_read ? '' : ' unread'));
    c.append(el('div', n.is_read ? '' : 'strong', n.message), el('div', 'hint', n.created));
    const row = el('div', 'btn-row');
    if (n.link && SAFE_LINK.test(n.link)) { const b = el('button', 'small', 'Open'); b.type = 'button'; b.addEventListener('click', () => open(n)); row.append(b); }
    if (!n.is_read) {
      const b = el('button', 'alt small', 'Mark read'); b.type = 'button';
      b.addEventListener('click', async () => { try { await api('/api/notifications/' + n.id + '/read', {}); load(); } catch (err) { showMsg(msg, err.message, false); } });
      row.append(b);
    }
    if (row.children.length) c.append(row);
    return c;
  }

  async function load() {
    try {
      const r = await api('/api/notifications?page=' + page + (unreadOnly ? '&unread=1' : ''));
      pages = r.pages;
      list.replaceChildren(...r.items.map(card));
      document.getElementById('empty').classList.toggle('hidden', r.items.length > 0);
      document.getElementById('nsub').textContent = r.unread ? r.unread + ' unread' : 'Updates about your requests, sessions, reviews and credits.';
      document.getElementById('pager').classList.toggle('hidden', pages <= 1);
      document.getElementById('page-info').textContent = 'Page ' + r.page + ' of ' + pages;
      document.getElementById('prev').disabled = page <= 1;
      document.getElementById('next').disabled = page >= pages;
      msg.className = 'msg';
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
    }
  }

  document.getElementById('read-all').addEventListener('click', async () => {
    try { await api('/api/notifications/read-all', {}); load(); } catch (err) { showMsg(msg, err.message, false); }
  });
  document.getElementById('unread-only').addEventListener('click', (e) => {
    unreadOnly = !unreadOnly; page = 1; e.target.textContent = unreadOnly ? 'Show all' : 'Show unread only'; load();
  });
  document.getElementById('prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
  document.getElementById('next').addEventListener('click', () => { if (page < pages) { page++; load(); } });
  load();
})();
