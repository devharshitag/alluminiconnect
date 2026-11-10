// Public mentor profile page: user.html?id=123
(function () {
  const card = document.getElementById('card');
  if (!card) return;
  const msg = document.getElementById('user-msg');
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MODE_LABEL = { chat: 'Chat', call: 'Call', in_person: 'In person' };
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showMsg(msg, 'No profile selected.', false);

  // Reviews from completed sessions (Module 6)
  function loadReviews(uid) {
    api('/api/reviews/mentor/' + encodeURIComponent(uid)).then((r) => {
      const sum = document.getElementById('rev-sum');
      sum.textContent = r.count ? 'Average ' + r.avg_rating + ' / 5 from ' + r.count + (r.count === 1 ? ' review' : ' reviews')
        + (r.helpfulness ? ' | Helpfulness ' + r.helpfulness + ', Clarity ' + r.clarity + ', Responsiveness ' + r.responsiveness : '') : 'No reviews yet.';
      const box = document.getElementById('reviews');
      r.reviews.forEach((v) => {
        const d = document.createElement('div'); d.className = 'req';
        const h = document.createElement('div'); h.className = 'hint'; h.textContent = v.rating + ' / 5 | ' + v.reviewer + ' | ' + v.created;
        d.append(h);
        if (v.comment) { const p = document.createElement('p'); p.className = 'pre'; p.textContent = v.comment; d.append(p); }
        const rep = document.createElement('button'); rep.type = 'button'; rep.className = 'alt small'; rep.textContent = 'Report review';
        rep.addEventListener('click', () => reportTarget('review', v.review_id)); d.append(rep);
        box.append(d);
      });
    }).catch(() => {});
  }

  api('/api/users/' + encodeURIComponent(id)).then((u) => {
    document.getElementById('name').textContent = u.full_name;
    document.getElementById('line').textContent =
      [u.role === 'alumni' ? 'Alumni' : 'Senior', u.department, u.university].filter(Boolean).join(' | ');
    const av = document.getElementById('avail');
    av.textContent = u.accepting_requests ? 'Accepting requests' : 'Not accepting requests';
    av.className = 'badge ' + (u.accepting_requests ? 'verified' : 'pending');
    const rb = document.getElementById('request-btn');
    if (u.accepting_requests) { rb.href = 'request-new.html?mentor=' + encodeURIComponent(u.user_id); rb.classList.remove('hidden'); }
    document.getElementById('report-btn').addEventListener('click', () => reportTarget('user', u.user_id));
    document.getElementById('block-btn').addEventListener('click', async () => { if (await blockUser(u.user_id, u.full_name)) location.href = 'mentors.html'; });
    document.getElementById('bio').textContent = u.bio || '';
    const info = document.getElementById('info');
    const add = (k, v) => { if (!v) return; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; info.append(dt, dd); };
    add('Organization', u.current_organization); add('Designation', u.designation);
    add('Year of study', u.year_of_study); add('Graduation year', u.graduation_year);
    add('Connect via', u.preferred_mode.map((m) => MODE_LABEL[m]).join(', ')); add('Email', u.email);
    if (u.linkedin_url) {
      const dt = document.createElement('dt'); dt.textContent = 'LinkedIn';
      const dd = document.createElement('dd'); const a = document.createElement('a');
      a.href = u.linkedin_url; a.textContent = u.linkedin_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; dd.append(a); info.append(dt, dd);
    }
    const tags = document.getElementById('tags');
    u.expertise.forEach((t) => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = t.name + ' (' + t.skill_level + ')'; tags.append(c); });
    const slots = document.getElementById('slots');
    document.getElementById('no-slots').classList.toggle('hidden', u.slots.length > 0);
    u.slots.forEach((s) => { const d = document.createElement('div'); d.textContent = DAYS[s.day_of_week] + ' ' + s.start_time + ' to ' + s.end_time + ' (' + MODE_LABEL[s.mode] + ')'; slots.append(d); });
    card.classList.remove('hidden');
    loadReviews(u.user_id);
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
  });
})();
