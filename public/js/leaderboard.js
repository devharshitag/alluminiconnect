// Leaderboard page: all time, this month, this week
(function () {
  const rows = document.getElementById('rows');
  if (!rows) return;
  const msg = document.getElementById('lmsg');
  const LEVEL = { unranked: 'Unranked', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

  async function load(period) {
    try {
      const r = await api('/api/credits/leaderboard?period=' + period);
      rows.replaceChildren(...r.entries.map((e) => {
        const tr = el('tr', e.is_me ? 'me' : '');
        const name = el('td'); const a = el('a', '', e.full_name); a.href = 'user.html?id=' + e.user_id; name.append(a, el('span', 'hint', ' ' + (e.role === 'alumni' ? 'Alumni' : 'Senior')));
        tr.append(el('td', '', String(e.rank)), name, el('td', '', e.department || '-'), el('td', '', LEVEL[e.level] || e.level),
          el('td', '', String(e.credits)), el('td', '', e.avg_rating !== null ? e.avg_rating.toFixed(1) : '-'), el('td', '', String(e.sessions)));
        return tr;
      }));
      document.getElementById('empty').classList.toggle('hidden', r.entries.length > 0);
      document.getElementById('tbl').classList.toggle('hidden', r.entries.length === 0);
      msg.className = 'msg';
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
    }
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t)); load(t.dataset.period);
  }));
  load('alltime');
})();
