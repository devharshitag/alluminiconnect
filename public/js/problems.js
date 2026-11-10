// Problems page: post a problem, browse the board (mentors) or my problems (relies on api(), showMsg(), el() from app.js)
(function () {
  const list = document.getElementById('plist');
  if (!list) return;
  const filter = document.getElementById('pfilter');
  const listMsg = document.getElementById('list-msg');
  const summary = document.getElementById('summary');
  const pager = document.getElementById('pager');
  const newForm = document.getElementById('new-form');
  const newMsg = document.getElementById('new-msg');
  const LABEL = { in_discussion: 'In discussion', open: 'Open', resolved: 'Resolved', closed: 'Closed' };
  let view = 'mine'; let page = 1; let pages = 0; let canBoard = false;

  function card(p) {
    const c = el('div', 'pcard');
    const head = el('div', 'mhead');
    const a = el('a', 'ptitle', p.title); a.href = 'problem.html?id=' + p.problem_id;
    const badges = el('span');
    badges.append(el('span', 'badge ' + p.urgency, p.urgency + ' urgency'), ' ', el('span', 'badge ' + p.status, LABEL[p.status]));
    head.append(a, badges);
    c.append(head);
    c.append(el('div', 'hint', [p.category, p.asker, p.created, p.offers + (p.offers === 1 ? ' offer' : ' offers')].join(' | ')));
    if (p.tags.length || p.matches) {
      const chips = el('div', 'chips');
      if (p.matches) chips.append(el('span', 'chip match', 'Matches your expertise'));
      p.tags.forEach((t) => chips.append(el('span', 'chip', t.name)));
      c.append(chips);
    }
    return c;
  }

  function params() {
    const p = new URLSearchParams();
    if (view === 'mine') p.set('mine', '1');
    ['q', 'category', 'tag_id', 'status'].forEach((n) => { const v = filter.elements[n].value.trim(); if (v) p.set(n, v); });
    if (page > 1) p.set('page', String(page));
    return p;
  }

  async function load() {
    listMsg.className = 'msg';
    try {
      const r = await api('/api/problems?' + params().toString());
      pages = r.pages;
      list.replaceChildren(...r.problems.map(card));
      summary.textContent = r.total ? r.total + (r.total === 1 ? ' problem' : ' problems')
        : (view === 'mine' ? 'You have not posted any problems yet.' : 'No open problems match right now.');
      pager.classList.toggle('hidden', pages <= 1);
      document.getElementById('page-info').textContent = 'Page ' + r.page + ' of ' + pages;
      document.getElementById('prev').disabled = page <= 1;
      document.getElementById('next').disabled = page >= pages;
    } catch (err) {
      if (err.status === 401) location.href = 'login.html';
      else showMsg(listMsg, err.message, false);
    }
  }

  function setView(v) {
    view = v; page = 1;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
    document.getElementById('psub').textContent = v === 'mine'
      ? 'Problems you posted. Mentors who offer help appear on each problem.'
      : 'Open problems from your university, best topic matches first.';
    load();
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
  filter.addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });
  ['category', 'tag_id', 'status'].forEach((n) => filter.elements[n].addEventListener('change', () => { page = 1; load(); }));
  document.getElementById('prev').addEventListener('click', () => { if (page > 1) { page--; load(); window.scrollTo(0, 0); } });
  document.getElementById('next').addEventListener('click', () => { if (page < pages) { page++; load(); window.scrollTo(0, 0); } });

  // Topic pickers (form checkboxes and the filter dropdown)
  api('/api/tags').then((domains) => {
    const pick = document.getElementById('tagpick');
    const sel = document.getElementById('f-tag');
    domains.forEach((d) => {
      const g = document.createElement('optgroup'); g.label = d.name; g.append(new Option('All ' + d.name, d.tag_id));
      [d, ...d.children].forEach((t) => {
        const l = el('label'); const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.name = 'tag'; cb.value = t.tag_id;
        l.append(cb, t === d ? d.name + ' (general)' : d.name + ': ' + t.name); pick.append(l);
        if (t !== d) g.append(new Option(t.name, t.tag_id));
      });
      sel.append(g);
    });
    pick.addEventListener('change', () => {
      const boxes = [...pick.querySelectorAll('input:checked')];
      pick.querySelectorAll('input:not(:checked)').forEach((b) => { b.disabled = boxes.length >= 5; });
    });
  }).catch(() => {});

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = newForm.elements;
    const body = {
      title: f.title.value, description: f.description.value, category: f.category.value, urgency: f.urgency.value,
      preferred_mentor_type: f.preferred_mentor_type.value, is_anonymous: f.is_anonymous.checked,
      tag_ids: [...newForm.querySelectorAll('#tagpick input:checked')].map((b) => Number(b.value)),
    };
    const btn = newForm.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await api('/api/problems', body);
      location.href = 'problem.html?id=' + r.problem_id;
    } catch (err) {
      if (err.status === 401) location.href = 'login.html'; else showMsg(newMsg, err.message, false);
    } finally { btn.disabled = false; }
  });

  api('/api/auth/me').then((u) => {
    canBoard = (u.role === 'senior' || u.role === 'alumni') && u.verification_status === 'verified';
    document.getElementById('tab-board').classList.toggle('hidden', !canBoard);
    if (u.role === 'admin') { location.href = 'dashboard.html'; return; }
    setView(canBoard ? 'board' : 'mine');
  }).catch(() => { location.href = 'login.html'; });
})();
