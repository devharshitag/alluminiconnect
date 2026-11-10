// Sessions page: schedule (mentor), complete / cancel / no-show, and reviews
(function () {
  const list = document.getElementById('slist');
  if (!list) return;
  const msg = document.getElementById('smsg');
  const MODE = { chat: 'Chat', call: 'Call', in_person: 'In person' };
  const STATUS = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', mentor_no_show: 'Mentor no-show', mentee_no_show: 'Mentee no-show' };
  let scope = 'upcoming';

  async function act(path, body, okText) {
    try { await api(path, body); await load(); showMsg(msg, okText || 'Done.', true); }
    catch (err) { showMsg(msg, err.message, false); }
  }

  function select(name, values) {
    const s = el('select'); s.name = name;
    s.append(new Option(name === 'rating' ? 'Choose...' : 'Skip', ''));
    values.forEach((v) => s.append(new Option(v + ' / 5', v)));
    return s;
  }

  function reviewForm(s) {
    const f = el('form', 'inline-form');
    const mentee = s.role === 'mentee';
    const f2 = {};
    if (mentee) {
      const wrap = el('div', 'row3');
      [['rating', 'Overall rating'], ['helpfulness', 'Helpfulness'], ['clarity', 'Clarity'], ['responsiveness', 'Responsiveness']].forEach(([k, label]) => {
        const d = el('div'); d.append(el('label', '', label)); f2[k] = select(k, [5, 4, 3, 2, 1]); d.append(f2[k]); wrap.append(d);
      });
      f.append(wrap);
    }
    f.append(el('label', '', mentee ? 'Comment (optional)' : 'Feedback for the student'));
    const c = el('textarea'); c.maxLength = 1000; f.append(c);
    const go = el('button', 'small', 'Submit review'); go.type = 'submit'; f.append(go);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = { comment: c.value };
      Object.keys(f2).forEach((k) => { if (f2[k].value) body[k] = Number(f2[k].value); });
      act('/api/sessions/' + s.session_id + '/review', body, 'Review saved.');
    });
    return f;
  }

  function stars(n) { return n ? n + '/5' : '-'; }

  function card(s) {
    const c = el('div', 'req');
    const head = el('div', 'mhead');
    head.append(el('strong', '', (s.role === 'mentor' ? 'With student ' : 'With mentor ') + s.other_name), el('span', 'badge ' + (s.status === 'completed' ? 'completed' : s.status === 'scheduled' ? 'open' : 'closed'), STATUS[s.status]));
    c.append(head);
    c.append(el('div', 'hint', s.start.replace('T', ' ') + ' to ' + s.end.slice(11) + ' | ' + MODE[s.mode]));
    c.append(el('p', '', 'Goal: ' + s.goal));
    if (s.meeting_link) {
      if (/^https:\/\//i.test(s.meeting_link)) { const a = el('a', '', 'Join: ' + s.meeting_link); a.href = s.meeting_link; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); }
      else c.append(el('div', 'hint', 'Place: ' + s.meeting_link));
    }
    s.reviews.forEach((r) => {
      const who = r.by_me ? 'Your review' : (r.direction === 'mentee_to_mentor' ? 'Student review' : 'Mentor feedback');
      const parts = [];
      if (r.rating) parts.push('Overall ' + stars(r.rating) + (r.helpfulness || r.clarity || r.responsiveness ? ' (helpful ' + stars(r.helpfulness) + ', clear ' + stars(r.clarity) + ', responsive ' + stars(r.responsiveness) + ')' : ''));
      if (r.comment) parts.push(r.comment);
      c.append(el('div', 'hint', who + ': ' + parts.join(' | ')));
    });
    const row = el('div', 'btn-row');
    const btn = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); row.append(b); };
    const set = (status, confirmText) => () => { if (confirm(confirmText)) act('/api/sessions/' + s.session_id + '/status', { status }); };
    if (s.can_complete) btn('Mark completed', 'small', set('completed', 'Mark this session as completed? You will earn credits.'));
    if (s.can_mentee_no_show) btn('Student did not show up', 'alt small', set('mentee_no_show', 'Report that the student did not show up?'));
    if (s.can_mentor_no_show) btn('Mentor did not show up', 'alt small', set('mentor_no_show', 'Report that the mentor did not show up? This lowers their credits.'));
    if (s.can_cancel) btn('Cancel session', 'danger small', set('cancelled', 'Cancel this session?'));
    if (s.can_review) {
      const form = reviewForm(s); form.classList.add('hidden');
      btn('Leave a review', 'small', () => form.classList.toggle('hidden'));
      c.append(row, form);
    } else if (row.children.length) c.append(row);
    return c;
  }

  async function load() {
    try {
      const r = await api('/api/sessions/mine?scope=' + scope);
      list.replaceChildren(...r.sessions.map(card));
      document.getElementById('empty').classList.toggle('hidden', r.sessions.length > 0);
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
    }
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    scope = t.dataset.scope; msg.className = 'msg';
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t)); load();
  }));

  // Scheduling form (mentor, opened from Requests with ?request=<id>)
  const reqId = Number(qs.get('request'));
  const form = document.getElementById('sched-form');
  const mode = document.getElementById('mode');
  const link = document.getElementById('link');
  function syncMode() {
    const p = mode.value === 'in_person';
    document.getElementById('link-label').textContent = p ? 'Place to meet' : 'Meeting link';
    link.placeholder = p ? 'e.g. Library, 2nd floor' : 'https://meet.google.com/...';
  }
  mode.addEventListener('change', syncMode); syncMode();
  if (reqId) {
    api('/api/requests?box=incoming').then((r) => {
      const q = r.requests.find((x) => x.request_id === reqId && ['accepted', 'in_progress'].includes(x.status));
      if (!q) return;
      document.getElementById('sched-who').textContent = 'With ' + q.other_name + ' | Goal: ' + q.goal;
      document.getElementById('sched-card').classList.remove('hidden');
    }).catch(() => {});
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('sched-msg');
    const start = document.getElementById('start').value;
    if (!start) return showMsg(m, 'Pick a start date and time.', false);
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      await api('/api/sessions', { request_id: reqId, start, duration_minutes: Number(document.getElementById('duration').value), mode: mode.value, meeting_link: link.value });
      showMsg(m, 'Session scheduled. The student was notified.', true);
      form.reset(); syncMode(); scope = 'upcoming';
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.scope === 'upcoming')); load();
    } catch (err) { showMsg(m, err.message, false); }
    finally { btn.disabled = false; }
  });

  api('/api/auth/me').then((u) => { if (u.role === 'admin') location.href = 'dashboard.html'; else load(); })
    .catch(() => { location.href = 'login.html'; });
})();
