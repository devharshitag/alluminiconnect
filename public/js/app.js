// Small shared helpers + per-page behaviour (no inline scripts, so the strict CSP stays intact)
async function api(path, body, method) {
  const opts = { method: method || (body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  let json = {};
  try { json = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(json.error || 'Request failed'); err.status = res.status; throw err; }
  return json;
}

function showMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text;           // textContent, never innerHTML: prevents XSS
  el.className = 'msg ' + (ok ? 'ok' : 'err');
}

const qs = new URLSearchParams(location.search);

// Tiny DOM helper used by several pages (always textContent, never innerHTML)
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Generic JSON forms:  <form data-api="/api/auth/login" data-next="dashboard.html">
document.querySelectorAll('form[data-api]').forEach((form) => {
  const msg = form.querySelector('.msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const body = Object.fromEntries(new FormData(form).entries());
    // Hidden role-specific sections must not be submitted
    form.querySelectorAll('.hidden input, .hidden select').forEach((el) => delete body[el.name]);
    if (btn) btn.disabled = true;
    try {
      const json = await api(form.dataset.api, body);
      form.dispatchEvent(new CustomEvent('sa-success', { detail: { json, body } }));
      if (form.dataset.next) {
        const sep = form.dataset.next.includes('?') ? '&' : '?';
        const carry = form.dataset.carryEmail ? `${sep}email=${encodeURIComponent(body.email || '')}` : '';
        location.href = form.dataset.next + carry;
      } else showMsg(msg, json.message, true);
    } catch (err) {
      showMsg(msg, err.message, false);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});

// Pre-fill email from ?email= on verify / reset pages
const emailInput = document.querySelector('input[name=email]');
if (emailInput && qs.get('email') && !emailInput.value) emailInput.value = qs.get('email');

// ---------------------------------------------------------------- register page
const reg = document.getElementById('register-form');
if (reg) {
  const uniSel = reg.querySelector('[name=university_id]');
  const deptSel = reg.querySelector('[name=department_id]');
  const roleInputs = reg.querySelectorAll('input[name=role]');
  const yearField = document.getElementById('year-field');
  const alumniFields = document.getElementById('alumni-fields');
  let departments = [];

  const fillDepts = () => {
    deptSel.replaceChildren(new Option('Select department', ''));
    departments.filter((d) => String(d.university_id) === uniSel.value)
      .forEach((d) => deptSel.add(new Option(d.name, d.department_id)));
  };
  const applyRole = () => {
    const role = reg.querySelector('input[name=role]:checked').value;
    yearField.classList.toggle('hidden', role === 'alumni');
    alumniFields.classList.toggle('hidden', role !== 'alumni');
  };

  api('/api/meta/registration').then((m) => {
    departments = m.departments;
    uniSel.replaceChildren(new Option('Select university', ''));
    m.universities.forEach((u) => uniSel.add(new Option(u.name, u.university_id)));
    if (m.universities.length === 1) { uniSel.value = m.universities[0].university_id; }
    fillDepts();
  }).catch(() => showMsg(reg.querySelector('.msg'), 'Could not load universities. Is the server running?', false));

  uniSel.addEventListener('change', fillDepts);
  roleInputs.forEach((r) => r.addEventListener('change', applyRole));
  applyRole();

  reg.addEventListener('sa-success', (e) => {
    if (e.detail.json.needs_email_verification) {
      location.href = 'verify-email.html?email=' + encodeURIComponent(e.detail.body.email);
    }
  });
}

// ---------------------------------------------------------------- verify-email page
const resend = document.getElementById('resend');
if (resend) {
  resend.addEventListener('click', async () => {
    const email = document.querySelector('input[name=email]').value;
    const msg = document.querySelector('.msg');
    try { showMsg(msg, (await api('/api/auth/resend-otp', { email })).message, true); }
    catch (err) { showMsg(msg, err.message, false); }
  });
}

// ---------------------------------------------------------------- dashboard page
const profileBox = document.getElementById('profile');
if (profileBox) {
  api('/api/auth/me').then((u) => {
    document.getElementById('welcome').textContent = 'Welcome, ' + u.full_name;
    const badge = document.getElementById('badge');
    badge.textContent = u.verification_status === 'verified' ? 'Verified' : u.verification_status === 'rejected' ? 'Rejected' : 'Pending verification';
    badge.className = 'badge ' + u.verification_status;
    if (u.verification_status !== 'verified') document.getElementById('banner').classList.remove('hidden');
    document.querySelectorAll('[data-for]').forEach((a) => { if (a.dataset.for === 'admin' ? u.role === 'admin' : u.role !== 'admin') a.classList.remove('hidden'); });
    if (u.role === 'admin') document.getElementById('admin-link').classList.remove('hidden');
    else if (u.verification_status !== 'verified') document.getElementById('verify-link').classList.remove('hidden');

    const rows = [
      ['Role', u.role], ['University', u.university], ['Department', u.department],
      ['Email', u.email], ['Enrollment no.', u.enrollment_no], ['Program', u.program],
      ['Year of study', u.year_of_study], ['Graduation year', u.graduation_year],
      ['Organization', u.current_organization], ['Designation', u.designation],
    ].filter(([, val]) => val);
    const dl = document.getElementById('details');
    rows.forEach(([k, val]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = val;
      dl.append(dt, dd);
    });
  }).catch(() => { location.href = 'login.html'; });

  document.getElementById('logout').addEventListener('click', async () => {
    await api('/api/auth/logout', {});
    location.href = 'login.html';
  });
}

// ---------------------------------------------------------------- safety helpers (Module 8)
async function reportTarget(type, id) {
  const reason = prompt('What is wrong? Please explain briefly (at least 5 characters).');
  if (!reason) return;
  try { alert((await api('/api/reports', { target_type: type, target_id: id, reason })).message); }
  catch (err) { alert(err.message); }
}

async function blockUser(id, name) {
  if (!confirm('Block ' + name + '? You will no longer see each other in search, profiles or problems. You can unblock later.')) return false;
  try { alert((await api('/api/blocks', { user_id: id })).message); return true; }
  catch (err) { alert(err.message); return false; }
}

// ---------------------------------------------------------------- notification bell in the header (Module 8)
(function () {
  const page = location.pathname.split('/').pop();
  const skip = ['', 'index.html', 'login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'verify-email.html'];
  const nav = document.querySelector('header nav');
  if (!nav || skip.includes(page)) return;
  fetch('/api/notifications/count', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j) return;
      const a = el('a', '', j.unread ? 'Notifications (' + j.unread + ')' : 'Notifications');
      a.href = 'notifications.html';
      if (j.unread) a.style.fontWeight = '700';
      nav.prepend(a);
    }).catch(() => {});
})();
