// Admin moderation: reports, users, reviews, audit log
(function () {
  const msg = document.getElementById('mmsg');
  if (!msg) return;
  const $ = (x) => document.getElementById(x);
  const EFFECT = { user: 'Suspend user', review: 'Hide review', problem: 'Close problem' };
  let auditPage = 1; let auditPages = 0;

  const fail = (err) => {
    if (err.status === 401) location.href = 'login.html'; else if (err.status === 403) location.href = 'dashboard.html'; else showMsg(msg, err.message, false);
  };
  async function run(fn, reload) { try { const r = await fn(); showMsg(msg, r.message, true); reload(); } catch (err) { fail(err); } }
  const button = (row, text, cls, fn) => { const b = el('button', cls + ' small', text); b.type = 'button'; b.addEventListener('click', fn); row.append(b); };

  // ---- reports
  async function loadReports() {
    try {
      const r = await api('/api/moderation/reports?status=' + $('rstatus').value);
      $('n-open').textContent = r.counts.open ? '(' + r.counts.open + ')' : '';
      $('rlist').replaceChildren(...(r.reports.length ? r.reports.map((x) => {
        const c = el('div', 'pcard'); const h = el('div', 'mhead');
        h.append(el('strong', '', 'Report about a ' + x.target_type + ' (#' + x.target_id + ')'), el('span', 'badge ' + (x.status === 'open' ? 'high' : 'closed'), x.status));
        c.append(h, el('div', 'hint', 'By ' + x.reporter + ' | ' + x.created + (x.handled_by ? ' | handled by ' + x.handled_by + ' ' + x.handled : '')),
          el('p', '', 'Reason: ' + x.reason), el('p', 'pre hint', 'Content: ' + (x.preview || '(no longer exists)')));
        if (['open', 'reviewed'].includes(x.status)) {
          const row = el('div', 'btn-row');
          const resolve = (outcome, remarks) => run(() => api('/api/moderation/reports/' + x.report_id + '/resolve', { outcome, remarks: remarks || '' }), loadReports);
          button(row, EFFECT[x.target_type], 'danger', () => { if (confirm(EFFECT[x.target_type] + '?')) resolve('actioned', x.reason); });
          if (x.status === 'open') button(row, 'Mark reviewed', 'alt', () => resolve('reviewed'));
          button(row, 'Dismiss', 'alt', () => resolve('dismissed'));
          c.append(row);
        }
        return c;
      }) : [el('p', 'hint', 'No reports here.')]));
    } catch (err) { fail(err); }
  }

  // ---- users
  async function loadUsers() {
    try {
      const p = new URLSearchParams(); if ($('uq').value.trim()) p.set('q', $('uq').value.trim()); if ($('ustatus').value) p.set('status', $('ustatus').value);
      const r = await api('/api/moderation/users?' + p.toString());
      $('ulist').replaceChildren(...(r.users.length ? r.users.map((u) => {
        const c = el('div', 'pcard'); const h = el('div', 'mhead');
        h.append(el('strong', '', u.full_name + ' (' + u.role + ')'), el('span', 'badge ' + (u.account_status === 'active' ? 'open' : 'high'), u.account_status));
        c.append(h, el('div', 'hint', u.email + ' | verification: ' + u.verification_status));
        const row = el('div', 'btn-row');
        if (u.account_status === 'active') button(row, 'Suspend', 'danger', () => {
          const reason = prompt('Reason for suspending ' + u.full_name + ':'); if (!reason) return;
          run(() => api('/api/moderation/users/' + u.user_id + '/suspend', { reason }), loadUsers);
        });
        else button(row, 'Reactivate', 'alt', () => run(() => api('/api/moderation/users/' + u.user_id + '/reactivate', {}), loadUsers));
        c.append(row); return c;
      }) : [el('p', 'hint', 'No users found.')]));
    } catch (err) { fail(err); }
  }

  // ---- reviews
  async function loadReviews() {
    try {
      const r = await api('/api/moderation/reviews?hidden=' + $('vhidden').value);
      $('vlist').replaceChildren(...(r.reviews.length ? r.reviews.map((v) => {
        const c = el('div', 'pcard');
        c.append(el('div', 'hint', v.reviewer + ' about ' + v.reviewee + ' | ' + v.created + (v.rating ? ' | ' + v.rating + '/5' : '')), el('p', 'pre', v.comment || '(no comment)'));
        const row = el('div', 'btn-row');
        if (v.is_hidden) button(row, 'Unhide', 'alt', () => run(() => api('/api/moderation/reviews/' + v.review_id + '/unhide', {}), loadReviews));
        else button(row, 'Hide', 'danger', () => { if (confirm('Hide this review?')) run(() => api('/api/moderation/reviews/' + v.review_id + '/hide', {}), loadReviews); });
        c.append(row); return c;
      }) : [el('p', 'hint', 'No reviews here.')]));
    } catch (err) { fail(err); }
  }

  // ---- audit log
  async function loadAudit() {
    try {
      const r = await api('/api/moderation/audit?page=' + auditPage);
      auditPages = r.pages;
      $('alist').replaceChildren(...(r.logs.length ? r.logs.map((l) => {
        const c = el('div', 'pcard');
        c.append(el('div', '', l.action + (l.entity_type ? ' on ' + l.entity_type + ' #' + l.entity_id : '')),
          el('div', 'hint', l.created + ' | ' + (l.admin || 'system') + ' | ' + (l.details || '')));
        return c;
      }) : [el('p', 'hint', 'Nothing logged yet.')]));
      $('pager').classList.toggle('hidden', auditPages <= 1);
      $('page-info').textContent = 'Page ' + r.page + ' of ' + auditPages;
      $('prev').disabled = auditPage <= 1; $('next').disabled = auditPage >= auditPages;
    } catch (err) { fail(err); }
  }

  const loaders = { reports: loadReports, users: loadUsers, reviews: loadReviews, audit: loadAudit };
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    Object.keys(loaders).forEach((k) => $('tab-' + k).classList.toggle('hidden', k !== t.dataset.tab));
    msg.className = 'msg'; loaders[t.dataset.tab]();
  }));
  $('rstatus').addEventListener('change', loadReports);
  $('vhidden').addEventListener('change', loadReviews);
  $('ustatus').addEventListener('change', loadUsers);
  $('uform').addEventListener('submit', (e) => { e.preventDefault(); loadUsers(); });
  $('prev').addEventListener('click', () => { if (auditPage > 1) { auditPage--; loadAudit(); } });
  $('next').addEventListener('click', () => { if (auditPage < auditPages) { auditPage++; loadAudit(); } });
  loadReports();
})();
