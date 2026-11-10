// Profile page: basics, topics and availability (relies on api() and showMsg() from app.js)
(function () {
  const basics = document.getElementById('basics-form');
  if (!basics) return;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MODE_LABEL = { chat: 'Chat', call: 'Call', in_person: 'In person' };
  const LEVELS = ['beginner', 'intermediate', 'expert'];
  const msg = basics.querySelector('.msg');
  const topicsMsg = document.getElementById('topics-msg');
  const slotMsg = document.getElementById('slot-msg');
  let me = null; let tags = [];
  const isMentor = () => me.role === 'senior' || me.role === 'alumni';
  const field = (n) => basics.elements[n];
  const modeBoxes = () => [...basics.querySelectorAll('input[name=mode]')];
  const show = (sel, on) => document.querySelectorAll(sel).forEach((e) => e.classList.toggle('hidden', !on));

  function fillBasics() {
    document.getElementById('who').textContent = me.full_name + ' (' + me.role + ')';
    field('bio').value = me.bio || '';
    field('linkedin_url').value = me.linkedin_url || '';
    field('current_organization').value = me.current_organization || '';
    field('designation').value = me.designation || '';
    modeBoxes().forEach((b) => { b.checked = me.preferred_mode.includes(b.value); });
    field('show_linkedin').checked = me.show_linkedin; field('show_email').checked = me.show_email;
    field('is_accepting_requests').checked = me.is_accepting_requests; field('is_paused').checked = me.is_paused;
    field('max_active_mentees').value = me.max_active_mentees;
    show('.alumni-only', me.role === 'alumni'); show('.mentor-only', isMentor());
    if (isMentor()) {
      const w = document.getElementById('public-link-wrap'); w.replaceChildren();
      const a = document.createElement('a'); a.href = 'user.html?id=' + me.user_id; a.textContent = 'See how others view your profile';
      w.append(a);
    }
  }

  basics.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      bio: field('bio').value, linkedin_url: field('linkedin_url').value,
      preferred_mode: modeBoxes().filter((b) => b.checked).map((b) => b.value),
      show_linkedin: field('show_linkedin').checked, show_email: field('show_email').checked,
    };
    if (me.role === 'alumni') { body.current_organization = field('current_organization').value; body.designation = field('designation').value; }
    if (isMentor()) {
      body.is_accepting_requests = field('is_accepting_requests').checked; body.is_paused = field('is_paused').checked;
      body.max_active_mentees = Number(field('max_active_mentees').value);
    }
    const btn = basics.querySelector('button[type=submit]'); btn.disabled = true;
    try { showMsg(msg, (await api('/api/profile/me', body, 'PUT')).message, true); }
    catch (err) { showMsg(msg, err.message, false); }
    finally { btn.disabled = false; }
  });

  // ---------------- topics
  const topicRows = []; // { tag_id, interest, mentor, level }
  function topicRow(t) {
    const cur = (kind) => me.expertise.find((x) => x.tag_id === t.tag_id && x.kind === kind);
    const row = document.createElement('div'); row.className = 'tagrow';
    const name = document.createElement('span'); name.className = 'tagname'; name.textContent = t.name;
    const mk = (label, checked) => {
      const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
      l.append(c, ' ' + label); return [l, c];
    };
    const [li, interest] = mk('Interested', !!cur('interested'));
    row.append(name, li);
    const rec = { tag_id: t.tag_id, interest, mentor: null, level: null };
    if (isMentor()) {
      const [lm, mentor] = mk('I can mentor', !!cur('can_mentor'));
      const level = document.createElement('select');
      LEVELS.forEach((l) => level.add(new Option(l[0].toUpperCase() + l.slice(1), l)));
      level.value = (cur('can_mentor') || {}).skill_level || 'intermediate';
      level.disabled = !mentor.checked; mentor.addEventListener('change', () => { level.disabled = !mentor.checked; });
      row.append(lm, level); rec.mentor = mentor; rec.level = level;
    }
    topicRows.push(rec); return row;
  }
  function renderTopics() {
    const box = document.getElementById('topics'); box.replaceChildren(); topicRows.length = 0;
    if (isMentor()) document.getElementById('topics-sub').textContent = 'Pick topics you can mentor and topics you want to learn about.';
    tags.forEach((d) => {
      const h = document.createElement('h2'); h.className = 'domain'; box.append(h); h.textContent = d.name;
      box.append(topicRow(d)); d.children.forEach((c) => { const r = topicRow(c); r.classList.add('child'); box.append(r); });
    });
  }
  document.getElementById('save-topics').addEventListener('click', async () => {
    const body = {
      can_mentor: topicRows.filter((r) => r.mentor && r.mentor.checked).map((r) => ({ tag_id: r.tag_id, skill_level: r.level.value })),
      interested: topicRows.filter((r) => r.interest.checked).map((r) => ({ tag_id: r.tag_id })),
    };
    try { showMsg(topicsMsg, (await api('/api/profile/expertise', body, 'PUT')).message, true); }
    catch (err) { showMsg(topicsMsg, err.message, false); }
  });

  // ---------------- availability
  function renderSlots() {
    const box = document.getElementById('slots'); box.replaceChildren();
    document.getElementById('no-slots').classList.toggle('hidden', me.slots.length > 0);
    me.slots.forEach((s) => {
      const row = document.createElement('div'); row.className = 'tagrow';
      const t = document.createElement('span'); t.className = 'tagname';
      t.textContent = DAYS[s.day_of_week] + ' ' + s.start_time + ' to ' + s.end_time + ' (' + MODE_LABEL[s.mode] + ')' + (s.is_active ? '' : ' - off');
      const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'small alt'; tog.textContent = s.is_active ? 'Turn off' : 'Turn on';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'small danger'; del.textContent = 'Delete';
      tog.addEventListener('click', () => slotAction(() => api('/api/profile/slots/' + s.slot_id, { is_active: !s.is_active }, 'PATCH')));
      del.addEventListener('click', () => slotAction(() => api('/api/profile/slots/' + s.slot_id, null, 'DELETE')));
      row.append(t, tog, del); box.append(row);
    });
  }
  async function slotAction(fn) {
    try { showMsg(slotMsg, (await fn()).message, true); await reload(); }
    catch (err) { showMsg(slotMsg, err.message, false); }
  }
  document.getElementById('slot-form').addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target;
    slotAction(() => api('/api/profile/slots', {
      day_of_week: Number(f.elements.day_of_week.value), start_time: f.elements.start_time.value,
      end_time: f.elements.end_time.value, mode: f.elements.mode.value,
    }, 'POST'));
  });

  async function reload() { me = await api('/api/profile/me'); renderSlots(); }

  Promise.all([api('/api/profile/me'), api('/api/tags')]).then(([m, t]) => {
    me = m; tags = t; fillBasics(); renderTopics(); renderSlots();
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html';
    else if (err.status === 403) { document.querySelector('main').textContent = 'Administrators do not have a mentoring profile.'; }
    else showMsg(msg, err.message, false);
  });
})();
