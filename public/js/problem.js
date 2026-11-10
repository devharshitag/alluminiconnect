// Single problem page: details, mentor offers, resolve / close
(function () {
  const card = document.getElementById('card');
  if (!card) return;
  const msg = document.getElementById('pmsg');
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showMsg(msg, 'No problem selected.', false);
  const LABEL = { in_discussion: 'In discussion', open: 'Open', resolved: 'Resolved', closed: 'Closed' };
  const $ = (x) => document.getElementById(x);

  async function act(path, body, okText) {
    try { await api(path, body || {}); location.reload(); }
    catch (err) { showMsg(msg, err.message, false); }
  }

  function offerCard(o, p) {
    const c = el('div', 'req');
    const head = el('div', 'mhead');
    const a = el('a', 'mname', o.full_name); a.href = 'user.html?id=' + o.mentor_id;
    head.append(a, el('span', 'hint', o.created));
    c.append(head);
    const sub = [o.role === 'alumni' ? 'Alumni' : 'Senior', [o.designation, o.current_organization].filter(Boolean).join(' at '),
      o.rating !== null ? 'Rating ' + o.rating.toFixed(1) : ''].filter(Boolean).join(' | ');
    c.append(el('div', 'hint', sub), el('p', 'pre', o.message));
    if (p.is_owner && ['open', 'in_discussion'].includes(p.status)) {
      const row = el('div', 'btn-row');
      const req = el('a', 'btn small', 'Request mentorship');
      req.href = 'request-new.html?mentor=' + o.mentor_id + '&problem=' + p.problem_id; req.style.margin = '10px 0 0';
      const res = el('button', 'alt small', 'This solved it'); res.type = 'button';
      res.addEventListener('click', () => { if (confirm('Mark the problem as solved by ' + o.full_name + '? They will earn credits.')) act('/api/problems/' + p.problem_id + '/resolve', { mentor_id: o.mentor_id }); });
      row.append(req, res); c.append(row);
    }
    return c;
  }

  api('/api/problems/' + encodeURIComponent(id)).then((p) => {
    $('ptitle').textContent = p.title;
    $('pmeta').textContent = [p.category, 'Asked by ' + p.asker, p.created].join(' | ');
    $('p-urgency').textContent = p.urgency + ' urgency'; $('p-urgency').className = 'badge ' + p.urgency;
    $('p-status').textContent = LABEL[p.status]; $('p-status').className = 'badge ' + p.status;
    $('pdesc').textContent = p.description;
    p.tags.forEach((t) => $('ptags').append(el('span', 'chip', t.name)));
    card.classList.remove('hidden');
    if (!p.is_owner) {
      const rep = el('button', 'alt small', 'Report this problem'); rep.type = 'button';
      rep.addEventListener('click', () => reportTarget('problem', p.problem_id)); card.append(rep);
    }
    const isOpen = ['open', 'in_discussion'].includes(p.status);

    if (p.is_owner) {
      $('owner-actions').classList.toggle('hidden', !isOpen);
      $('resolve-none').addEventListener('click', () => { if (confirm('Mark this problem as resolved?')) act('/api/problems/' + p.problem_id + '/resolve'); });
      $('close-btn').addEventListener('click', () => { if (confirm('Close this problem without resolving it?')) act('/api/problems/' + p.problem_id + '/close'); });
      $('offers-title').textContent = 'Offers (' + p.offers_count + ')';
      $('offers').replaceChildren(...(p.offers.length ? p.offers.map((o) => offerCard(o, p)) : [el('p', 'hint', 'No offers yet. Mentors who can help will appear here.')]));
      $('offers-card').classList.remove('hidden');
    } else if (p.my_offer) {
      $('my-offer').textContent = p.my_offer.message; $('my-offer-card').classList.remove('hidden');
    } else if (isOpen) {
      $('offer-form-card').classList.remove('hidden');
    }
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html'; else showMsg(msg, err.message, false);
  });

  $('offer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await api('/api/problems/' + encodeURIComponent(id) + '/offers', { message: $('offer-msg').value }); location.reload(); }
    catch (err) { showMsg($('offer-msg-box'), err.message, false); btn.disabled = false; }
  });
})();
