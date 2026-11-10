// Admin page: review queue for verification documents
(function () {
  const list = document.getElementById('list');
  if (!list) return;
  const msg = document.getElementById('admin-msg');
  const empty = document.getElementById('empty');
  const LABELS = { id_card: 'ID card', marksheet: 'Marksheet', degree_certificate: 'Degree certificate' };
  let current = 'pending';

  const line = (k, v) => {
    if (!v && v !== 0) return null;
    const d = document.createElement('div'); d.textContent = k + ': ' + v; return d;
  };

  function card(r) {
    const el = document.createElement('div'); el.className = 'req';
    const h = document.createElement('strong'); h.textContent = r.full_name + ' (' + r.role + ')';
    el.append(h);
    [line('Email', r.email + (r.email_verified_at ? ' (email verified)' : ' (email not verified)')),
      line('University', r.university), line('Department', r.department),
      line('Enrollment no.', r.enrollment_no), line('Program', r.program),
      line('Year of study', r.year_of_study), line('Graduation year', r.graduation_year),
      line('Organization', r.current_organization), line('Designation', r.designation),
      line('Document type', LABELS[r.document_type]), line('Submitted', new Date(r.created_at).toLocaleString()),
    ].forEach((d) => d && el.append(d));
    const a = document.createElement('a'); a.href = '/api/verification/' + r.verification_id + '/file';
    a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open document'; el.append(a);

    if (r.status !== 'pending') {
      const s = document.createElement('div'); s.className = 'hint';
      s.textContent = (r.status === 'verified' ? 'Approved' : 'Rejected') + (r.remarks ? ': ' + r.remarks : '');
      el.append(s); return el;
    }
    const note = document.createElement('input'); note.type = 'text'; note.maxLength = 255;
    note.placeholder = 'Remarks (required when rejecting)'; note.style.marginTop = '10px';
    const row = document.createElement('div'); row.className = 'btn-row';
    const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Approve';
    const no = document.createElement('button'); no.type = 'button'; no.textContent = 'Reject'; no.className = 'danger';
    const act = (decision) => async () => {
      ok.disabled = no.disabled = true;
      try {
        const j = await api('/api/admin/verifications/' + r.verification_id + '/review', { decision, remarks: note.value });
        showMsg(msg, j.message, true); await refresh();
      } catch (err) { showMsg(msg, err.message, false); ok.disabled = no.disabled = false; }
    };
    ok.addEventListener('click', act('approve')); no.addEventListener('click', act('reject'));
    row.append(ok, no); el.append(note, row);
    return el;
  }

  async function refresh() {
    const [stats, rows] = await Promise.all([
      api('/api/admin/verifications/stats'),
      api('/api/admin/verifications?status=' + current),
    ]);
    ['pending', 'verified', 'rejected'].forEach((s) => { document.getElementById('n-' + s).textContent = stats[s]; });
    list.replaceChildren(...rows.map(card));
    empty.classList.toggle('hidden', rows.length > 0);
  }

  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === b));
    current = b.dataset.status; msg.className = 'msg'; refresh().catch(() => {});
  });

  refresh().catch((err) => {
    if (err.status === 401) location.href = 'login.html';
    else showMsg(msg, err.status === 403 ? 'Administrators only.' : err.message, false);
  });
})();
