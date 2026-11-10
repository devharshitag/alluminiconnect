// Requests page: outgoing (cancel) and incoming (accept / decline / end)
(function () {
  const list = document.getElementById('rlist');
  if (!list) return;
  const msg = document.getElementById('rmsg');
  const LABEL = { pending: 'Pending', accepted: 'Accepted', in_progress: 'In progress', completed: 'Ended', declined: 'Declined', cancelled: 'Cancelled' };
  let box = 'outgoing';

  async function act(path, body) {
    try { await api(path, body || {}); await load(); showMsg(msg, 'Done.', true); }
    catch (err) { showMsg(msg, err.message, false); }
  }

  function declineForm(r) {
    const f = el('form', 'inline-form');
    const reason = el('input'); reason.maxLength = 255; reason.placeholder = 'Reason (required)';
    const alt = el('input'); alt.type = 'datetime-local';
    const lab = el('label', '', 'Suggest another time (optional)');
    const go = el('button', 'danger small', 'Decline'); go.type = 'submit';
    f.append(reason, lab, alt, go);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = { decision: 'decline', decline_reason: reason.value };
      if (alt.value) body.alternative_slot_at = alt.value;
      act('/api/requests/' + r.request_id + '/respond', body);
    });
    return f;
  }

  function card(r) {
    const incoming = box === 'incoming';
    const c = el('div', 'req');
    const head = el('div', 'mhead');
    const who = el('a', 'mname', r.other_name); who.href = 'user.html?id=' + (incoming ? r.student_id : r.mentor_id);
    if (incoming) { who.removeAttribute('href'); } // students' profiles are not public
    head.append(who, el('span', 'badge ' + r.status, LABEL[r.status]));
    c.append(head, el('div', 'hint', (incoming ? 'Request received ' : 'Request sent ') + r.created),
      el('p', '', 'Goal: ' + r.goal), el('p', 'pre', r.message));
    if (r.problem_title) { const a = el('a', '', 'Problem: ' + r.problem_title); a.href = 'problem.html?id=' + r.problem_id; c.append(a); }
    if (r.next_session) c.append(el('div', 'hint', 'Next session: ' + r.next_session));
    if (r.status === 'declined') {
      c.append(el('div', 'hint', 'Reason: ' + (r.decline_reason || '-') + (r.alternative_slot ? ' | Suggested time: ' + r.alternative_slot : '')));
    }
    const row = el('div', 'btn-row');
    const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); row.append(b); return b; };
    const otherId = incoming ? r.student_id : r.mentor_id;
    const safety = () => {
      btn('Report', 'alt small', () => reportTarget('user', otherId));
      btn('Block', 'alt small', async () => { if (await blockUser(otherId, r.other_name)) load(); });
    };
    if (incoming && r.status === 'pending') {
      btn('Accept', 'small', () => act('/api/requests/' + r.request_id + '/respond', { decision: 'accept' }));
      const d = declineForm(r); d.classList.add('hidden');
      btn('Decline...', 'alt small', () => d.classList.toggle('hidden'));
      safety();
      c.append(row, d); return c;
    }
    if (incoming && ['accepted', 'in_progress'].includes(r.status)) {
      const sch = el('a', 'btn small', 'Schedule session'); sch.href = 'sessions.html?request=' + r.request_id; sch.style.margin = '10px 0 0'; row.append(sch);
    }
    if (['accepted', 'in_progress', 'completed'].includes(r.status)) {
      const all = el('a', 'btn small alt', 'View sessions'); all.href = 'sessions.html'; all.style.margin = '10px 0 0 8px'; row.append(all);
    }
    if (incoming && ['accepted', 'in_progress'].includes(r.status))
      btn('End mentorship', 'alt small', () => { if (confirm('End this mentorship?')) act('/api/requests/' + r.request_id + '/complete'); });
    if (!incoming && ['pending', 'accepted', 'in_progress'].includes(r.status))
      btn('Cancel request', 'danger small', () => { if (confirm('Cancel this request?')) act('/api/requests/' + r.request_id + '/cancel'); });
    safety();
    if (row.children.length) c.append(row);
    return c;
  }

  async function load() {
    try {
      const r = await api('/api/requests?box=' + box);
      list.replaceChildren(...r.requests.map(card));
      document.getElementById('empty').classList.toggle('hidden', r.requests.length > 0);
      if (box === 'incoming') {
        const n = r.requests.filter((x) => x.status === 'pending').length;
        document.getElementById('n-in').textContent = n ? '(' + n + ' new)' : '';
      }
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
    }
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    box = t.dataset.box; msg.className = 'msg';
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t)); load();
  }));

  api('/api/auth/me').then((u) => {
    if (u.role === 'admin') { location.href = 'dashboard.html'; return; }
    const mentor = u.role === 'senior' || u.role === 'alumni';
    document.getElementById('tab-in').classList.toggle('hidden', !mentor);
    if (mentor) document.querySelector('[data-box=incoming]').click(); else load();
  }).catch(() => { location.href = 'login.html'; });
})();
