// Mentor search page (relies on api() and showMsg() from app.js)
(function () {
  const form = document.getElementById('filter-form');
  if (!form) return;
  const msg = document.getElementById('search-msg');
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const pager = document.getElementById('pager');
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MODE_LABEL = { chat: 'Chat', call: 'Call', in_person: 'In person' };
  const FIELDS = ['q', 'tag_id', 'department_id', 'role', 'mode', 'day', 'sort'];
  let page = 1; let pages = 0;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function params() {
    const p = new URLSearchParams();
    FIELDS.forEach((n) => { const v = form.elements[n].value.trim(); if (v) p.set(n, v); });
    if (form.elements.available.checked) p.set('available', '1');
    if (page > 1) p.set('page', String(page));
    return p;
  }

  function card(m) {
    const c = el('div', 'mcard');
    const head = el('div', 'mhead');
    const a = el('a', 'mname', m.full_name); a.href = 'user.html?id=' + m.user_id;
    head.append(a, el('span', 'badge ' + (m.available ? 'verified' : 'pending'), m.available ? 'Accepting' : 'Busy'));
    c.append(head);
    const sub = [m.role === 'alumni' ? 'Alumni' : 'Senior', m.department].filter(Boolean).join(' | ');
    c.append(el('div', 'hint', sub));
    const work = [m.designation, m.current_organization].filter(Boolean).join(' at ');
    if (work) c.append(el('div', '', work));
    if (!work && m.role === 'senior' && m.year_of_study) c.append(el('div', '', 'Year ' + m.year_of_study));
    c.append(el('div', 'hint', m.rating !== null ? 'Rating ' + m.rating.toFixed(1) + ' (' + m.rating_count + ')' : 'No ratings yet'));
    if (m.topics.length) {
      const chips = el('div', 'chips');
      m.topics.forEach((t) => chips.append(el('span', 'chip' + (t.match ? ' match' : ''), t.name + ' - ' + t.skill_level)));
      c.append(chips);
    }
    const meta = [];
    if (m.days.length) meta.push('Free: ' + m.days.map((d) => DAYS[d]).join(', '));
    meta.push(m.preferred_mode.map((x) => MODE_LABEL[x]).join(', '));
    c.append(el('div', 'hint', meta.join(' | ')));
    return c;
  }

  async function search(pushUrl) {
    const p = params();
    if (pushUrl) history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
    msg.className = 'msg';
    try {
      const r = await api('/api/mentors?' + p.toString());
      pages = r.pages;
      results.replaceChildren(...r.mentors.map(card));
      summary.textContent = r.total ? r.total + (r.total === 1 ? ' mentor found' : ' mentors found') : 'No mentors match. Try removing a filter.';
      pager.classList.toggle('hidden', pages <= 1);
      document.getElementById('page-info').textContent = 'Page ' + r.page + ' of ' + pages;
      document.getElementById('prev').disabled = page <= 1;
      document.getElementById('next').disabled = page >= pages;
    } catch (err) {
      if (err.status === 401) location.href = 'login.html';
      else if (err.status === 403) summary.textContent = 'Administrators do not search for mentors.';
      else showMsg(msg, err.message, false);
    }
  }

  function loadFromUrl() {
    const p = new URLSearchParams(location.search);
    FIELDS.forEach((n) => { if (p.get(n)) form.elements[n].value = p.get(n); });
    form.elements.available.checked = p.get('available') === '1';
    page = Math.max(1, Number(p.get('page')) || 1);
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; search(true); });
  ['tag_id', 'department_id', 'role', 'mode', 'day', 'sort'].forEach((n) => form.elements[n].addEventListener('change', () => { page = 1; search(true); }));
  form.elements.available.addEventListener('change', () => { page = 1; search(true); });
  document.getElementById('reset').addEventListener('click', () => { form.reset(); page = 1; search(true); });
  document.getElementById('prev').addEventListener('click', () => { if (page > 1) { page--; search(true); window.scrollTo(0, 0); } });
  document.getElementById('next').addEventListener('click', () => { if (page < pages) { page++; search(true); window.scrollTo(0, 0); } });

  api('/api/mentors/filters').then((f) => {
    const dep = form.elements.department_id;
    f.departments.forEach((d) => dep.add(new Option(d.name, d.department_id)));
    const topic = form.elements.tag_id;
    f.topics.forEach((d) => {
      const g = document.createElement('optgroup'); g.label = d.name;
      g.append(new Option('All ' + d.name, d.tag_id));
      d.children.forEach((c) => g.append(new Option(c.name, c.tag_id)));
      topic.append(g);
    });
    loadFromUrl(); return search(false);
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html';
    else if (err.status === 403) { document.getElementById('summary').textContent = 'Administrators do not search for mentors.'; }
    else showMsg(msg, err.message, false);
  });
})();
