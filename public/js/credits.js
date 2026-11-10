// My credits page: balance, level, badges and the credit history
(function () {
  const card = document.getElementById('card');
  if (!card) return;
  const msg = document.getElementById('cmsg');
  const REASON = {
    session_completed: 'Session completed', problem_resolved: 'Problem solved', high_rating: 'High rating',
    availability_bonus: 'Availability bonus', request_spend: 'Request spent', no_show_penalty: 'Missed session',
    ignored_request_penalty: 'Ignored request', admin_adjustment: 'Admin adjustment',
  };
  const LEVEL = { unranked: 'Unranked', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

  function stat(label, value) {
    const d = el('div', 'stat'); d.append(el('div', 'stat-n', String(value)), el('div', 'stat-l', label)); return d;
  }

  api('/api/credits/me').then((r) => {
    if (!r.is_mentor) {
      document.getElementById('csub').textContent = 'Credits and badges are earned by seniors and alumni who mentor. Students can see the leaderboard.';
      card.classList.remove('hidden'); return;
    }
    const s = r.stats;
    document.getElementById('csub').textContent = 'Level: ' + LEVEL[s.level] + (s.rank ? ' | Rank #' + s.rank + ' at your university' : '');
    document.getElementById('stats').replaceChildren(
      stat('Total credits', s.total_credits), stat('This month', (s.this_month > 0 ? '+' : '') + s.this_month),
      stat('Sessions', s.sessions_completed), stat('Problems solved', s.problems_resolved),
      stat('Rating', s.avg_rating !== null ? s.avg_rating.toFixed(1) + ' (' + s.rating_count + ')' : '-'),
      stat('Avg reply', s.avg_response_minutes !== null ? (s.avg_response_minutes < 60 ? s.avg_response_minutes + ' min' : Math.round(s.avg_response_minutes / 60) + ' h') : '-'));
    document.getElementById('progress').textContent = s.next_level
      ? s.next_level.needed + ' more credits to reach ' + LEVEL[s.next_level.name] + '.' : 'You are at the top level.';

    const badges = document.getElementById('badges');
    r.badges.forEach((b) => {
      const d = el('div', 'badge-item' + (b.earned ? ' earned' : ''));
      d.append(el('strong', '', b.name), el('div', 'hint', b.description || ''), el('div', 'hint', b.earned ? 'Earned ' + b.awarded : 'Not earned yet'));
      badges.append(d);
    });
    const body = document.getElementById('hist');
    r.transactions.forEach((t) => {
      const tr = el('tr');
      tr.append(el('td', '', t.created), el('td', '', REASON[t.reason] || t.reason), el('td', t.delta >= 0 ? 'plus' : 'minus', (t.delta > 0 ? '+' : '') + t.delta));
      body.append(tr);
    });
    document.getElementById('no-hist').classList.toggle('hidden', r.transactions.length > 0);
    ['badge-card', 'how-card', 'hist-card'].forEach((id) => document.getElementById(id).classList.remove('hidden'));
    card.classList.remove('hidden');
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html';
    else if (err.status === 403) location.href = 'dashboard.html';
    else showMsg(msg, err.message, false);
  });
})();
