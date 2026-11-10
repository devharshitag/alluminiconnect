// New mentorship request: request-new.html?mentor=<id>[&problem=<id>]
(function () {
  const form = document.getElementById('req-form');
  if (!form) return;
  const msg = document.getElementById('req-msg');
  const mentorId = Number(qs.get('mentor'));
  const problemId = Number(qs.get('problem')) || null;
  if (!mentorId) return (document.getElementById('to').textContent = 'No mentor selected. Pick one from Find mentors.');

  api('/api/users/' + mentorId).then((u) => {
    document.getElementById('to').textContent = 'To: ' + u.full_name + ' (' + (u.role === 'alumni' ? 'Alumni' : 'Senior') + ')';
    if (!u.accepting_requests) { document.getElementById('to').textContent += ' - not accepting requests right now.'; return; }
    if (problemId) document.getElementById('problem-note').textContent = 'This request will be linked to your problem #' + problemId + '.';
    form.classList.remove('hidden');
  }).catch((err) => {
    if (err.status === 401) location.href = 'login.html'; else document.getElementById('to').textContent = err.message;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    const body = { mentor_id: mentorId, goal: form.elements.goal.value, message: form.elements.message.value };
    if (problemId) body.problem_id = problemId;
    try { await api('/api/requests', body); location.href = 'requests.html'; }
    catch (err) { showMsg(msg, err.message, false); btn.disabled = false; }
  });
})();
