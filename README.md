# Student Assist: Modules 1-6, Authentication, Verification, Profiles, Mentor Search, Problems, Requests, Sessions and Reviews

Node.js + Express + MySQL 8, with a plain HTML/CSS/JS frontend.

## Setup
1. Install Node.js 18+ and MySQL 8.
2. Create the database and seed data:
   `mysql -u root -p < schema.sql`
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env`, then set `DB_PASSWORD` and a long random `JWT_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
5. Start: `npm start`, then open http://localhost:3000

In development (no SMTP set) the OTP codes are printed in the server console.

Optional admin account (needed from Module 2 onward):
`node scripts/create-admin.js "Admin Name" admin@demo.edu.in "StrongPass1"`

## Try it
- Register as a student with an email ending in `@demo.edu.in` (the seeded university).
- Copy the 6-digit code from the console, verify, log in, and reach the dashboard.
- Register as alumni with a Gmail address: the account is created as `pending` and needs document verification (Module 2).
- Use "Forgot password" to test the reset flow.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/meta/registration | Universities and departments for the form |
| POST | /api/auth/register | Create student / senior / alumni account |
| POST | /api/auth/verify-email | Confirm university email with OTP |
| POST | /api/auth/resend-otp | Send a new verification code |
| POST | /api/auth/login | Log in (sets httpOnly cookie) |
| POST | /api/auth/logout | Clear session cookie |
| GET | /api/auth/me | Current user and profile (requires login) |
| POST | /api/auth/forgot-password | Email a reset code |
| POST | /api/auth/reset-password | Set new password with code |

## Security measures in this module
- Passwords hashed with bcrypt (cost 12); OTPs hashed too, expire in 10 minutes, max 5 attempts
- JWT stored in an httpOnly, SameSite=Strict cookie (limits XSS token theft and CSRF)
- All SQL is parameterized (no SQL injection); inputs validated with zod
- Helmet headers and strict CSP (no inline scripts); the UI uses textContent, never innerHTML
- Rate limiting on auth endpoints; same responses for unknown emails (no account enumeration)
- `requireAuth` re-checks account status on every request; `requireRole(...)` is ready for RBAC

## Known limitations (planned for later)
- Existing sessions are not revoked after a password reset (add a token version column)
- Document upload verification and admin review come in Module 2
- Seniors self-declare their year; the admin/document step confirms it


---
# Module 2: Document verification and admin review

Users who are not verified upload a proof document. An administrator approves or rejects it.

## Upgrade from Module 1 (no database reset needed)
1. Copy the new/changed files over your project (or use this folder).
2. `npm install` (adds `multer` for file uploads).
3. Create an admin if you have none:
   `node scripts/create-admin.js "Admin Name" admin@demo.edu.in "StrongPass1"`
4. `npm start`

The tables it uses (`verification_requests`, `notifications`, `audit_logs`) already exist in `schema.sql`.

## Pages
- `verification.html`: choose a document type, upload, and see the status of earlier submissions (user)
- `admin.html`: queue with Pending / Approved / Rejected tabs, open the document, approve or reject (admin only)
- `dashboard.html`: now links to both, depending on your role

## API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | /api/verification | student, senior, alumni | Upload a document (multipart: `document_type`, `document`) |
| GET | /api/verification/mine | any logged-in user | My submissions and their status |
| GET | /api/verification/:id/file | owner or admin | View the uploaded file |
| GET | /api/admin/verifications?status= | admin | List requests (pending, verified, rejected) |
| GET | /api/admin/verifications/stats | admin | Counts per status |
| POST | /api/admin/verifications/:id/review | admin | `{decision: "approve"|"reject", remarks}` |

## Rules
- Students and seniors may upload an ID card or marksheet; alumni may also upload a degree certificate.
- PDF, JPG or PNG only, maximum 5 MB. The type is checked from the file's first bytes, not its name.
- One pending document per user at a time. A rejected user can upload again.
- Rejecting needs a reason. Approving sets the user to `verified`, and rejecting sets `rejected`.
- Every review writes a notification for the user and a row in `audit_logs` (VERIFY_USER / REJECT_USER).
- Review is one database transaction, and a request can only be reviewed once.

## Security
- Files are saved in `uploads/` (outside `public/`) under random names and are only served through an access-checked route.
- Only the owner and admins can open a file; everyone else gets 404.
- Admin routes use `requireRole('admin')`. Uploads are rate limited (10 per hour per IP).

## Test it
1. Register an alumni account (Gmail is fine), log in, and open "Verify my account".
2. Upload a PDF or image. Try a `.txt` renamed to `.pdf`: it must be refused.
3. Log in as the admin, open the Admin review queue, open the document, and approve it.
4. Log back in as the alumni: the dashboard badge now says Verified.
5. Check `SELECT * FROM audit_logs;` and `SELECT * FROM notifications;`.


---
# Module 3: Profiles, topics and availability

Every non-admin user gets a profile page. Seniors and alumni also pick topics they can mentor, set when they are free, and control how many mentees they take. No database changes are needed: it uses `profiles`, `tags`, `user_expertise` and `availability_slots`.

## Upgrade from Module 2
1. Copy the new/changed files over your project (or use this folder), then `npm install` (no new packages) and restart `npm start`.
2. Banner should read `student-assist@0.3.0`.

## Pages
- `profile.html`: edit about, LinkedIn, organization/designation (alumni), connect modes, privacy, mentor settings, topics, availability
- `user.html?id=<user_id>`: how others see a mentor (read only)
- `dashboard.html`: new "My profile" link

## API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | /api/profile/me | student, senior, alumni | My profile, topics and slots |
| PUT | /api/profile/me | same | Save profile fields (send only what changes) |
| PUT | /api/profile/expertise | same | Replace my topics `{can_mentor:[{tag_id,skill_level}], interested:[{tag_id}]}` |
| POST | /api/profile/slots | senior, alumni | Add a slot `{day_of_week 0-6, start_time "HH:MM", end_time, mode}` |
| PATCH | /api/profile/slots/:id | senior, alumni | Turn a slot on/off `{is_active}` |
| DELETE | /api/profile/slots/:id | senior, alumni | Delete my slot |
| GET | /api/tags | logged in | Topic tree (domains with sub-topics) |
| GET | /api/users/:id | logged in | Public mentor profile |

## Rules
- Bio up to 1000 characters; LinkedIn must be an https linkedin.com link; at least one connect mode.
- Mentor settings (accepting, paused, most mentees 1-20) are for seniors and alumni only; organization and designation are for alumni only.
- Up to 15 "can mentor" and 15 "interested" topics; only seniors and alumni can list "can mentor".
- Up to 21 availability slots. Active slots on the same day cannot overlap; back-to-back is fine.
- Public profiles show only verified, active seniors and alumni of the viewer's own university. Email and LinkedIn appear only if the owner allows it.
- Unknown fields in a request are rejected, so nobody can change their role or status through the profile API.

## Test it
1. Log in as a verified alumni (from Module 2), open My profile, fill the form, Save.
2. Under Topics tick a few "I can mentor" boxes and save. Add two availability slots; try an overlapping one (refused).
3. Click "See how others view your profile". Log in as a student from the same university and open `user.html?id=<alumni user_id>`.
4. Turn off "Show my email" and check the student can no longer see it. Turn on "Pause my mentoring" and check it says "Not accepting requests".
5. Check the database: `SELECT * FROM profiles; SELECT * FROM user_expertise; SELECT * FROM availability_slots;`


---
# Module 4: Mentor search and matching

Students, seniors and alumni can search verified mentors from their own university, filter them, and see them ranked by how well they match. No database changes and no new packages.

## Upgrade from Module 3
Copy the new/changed files over your project (or use this folder) and restart `npm start`. Banner: `student-assist@0.4.0`.

## Pages
- `mentors.html`: search box, filters, sort, result cards, paging. Filters are kept in the address bar so a search can be shared.
- `dashboard.html`: new "Find mentors" link. Each result links to `user.html?id=...` (Module 3).

## API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | /api/mentors/filters | student, senior, alumni | Departments of my university and the topic tree |
| GET | /api/mentors | same | Search. Query: `q`, `tag_id`, `department_id`, `role` (senior/alumni), `mode` (chat/call/in_person), `day` (0-6), `available=1`, `sort` (best/rating/newest/name), `page` |

## Who appears
Only seniors and alumni who are verified and active, from the viewer's university, and never the viewer. Emails are never returned by search.

## Filters
- Search text matches name, organization or designation.
- Topic matches mentors who can mentor that topic or one of its sub-topics.
- "Only mentors accepting requests" means accepting, not paused, and below their mentee limit.
- "Free on" matches mentors with an active availability slot that day.

## Ranking ("Best match")
Score = 10 per matching topic + 5 if same department + 4 x average rating - 2 per current mentee + 3 if available.
"Matching topic" means the topic you filtered on, or if you did not filter, the topics you marked "Interested" on your profile. Matching topics show in green on the card. Other sorts: highest rated, newest, name.

## Safety
Every filter is validated; unknown values are rejected. Sorting uses a fixed list, search text is escaped, and all SQL is parameterised.

## Test it
1. Make sure you have at least two verified mentors (senior or alumni) with topics and availability set in Module 3, and a student who has ticked some "Interested" topics.
2. Log in as the student and open Find mentors. Mentors should be listed best match first, with matching topics in green.
3. Try each filter: topic, department, mentor type, connect by, free on, "only accepting". Pause one mentor in their profile and check "only accepting" hides them.
4. Search by part of a name or organization. Change the sort. With more than 12 mentors, check Previous/Next.
5. Click a card to open the mentor's profile.


---
# Module 5: Problems and mentorship requests

Students post problems with topics. Mentors browse the board and offer help. Anyone can send a mentorship request to a mentor, and the mentor accepts or declines. Uses `problems`, `problem_tags`, `problem_offers`, `mentorship_requests`. No database changes.

## Upgrade from Module 4
Copy the new/changed files over your project (or use this folder), run `npm install` (no new packages) and restart `npm start`. Banner version: `student-assist@0.5.0`.

New files: `src/routes/problems.js`, `src/routes/requests.js`, `src/notify.js`, `src/blocks.js`, `src/limits.js`, `src/credits.js`, `src/middleware/verified.js`, `public/problems.html`, `problem.html`, `request-new.html`, `requests.html` and their `public/js/` files.
Changed files: `server.js` (two new routes), `public/js/app.js`, `public/dashboard.html`, `public/user.html`, `public/js/user.js`, `public/css/style.css`.

## Pages
- `problems.html`: post a problem; "My problems" tab for everyone; "Problem board" tab for verified seniors and alumni (best topic matches first)
- `problem.html?id=`: details; the owner sees offers and can mark it solved or close it; mentors send one offer
- `request-new.html?mentor=<id>[&problem=<id>]`: request form (opened from a mentor's profile or an offer)
- `requests.html`: "I sent" (cancel) and "Sent to me" (accept, decline with reason and optional new time, end mentorship)

## API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | /api/problems | verified, non-admin | Post `{title, description, category, urgency, preferred_mentor_type, is_anonymous, tag_ids[]}` |
| GET | /api/problems?mine=1 | any | My problems (filters: status, category, tag_id, q, page) |
| GET | /api/problems | verified senior/alumni | Board of open problems at my university |
| GET | /api/problems/:id | owner or eligible mentor | Detail (owner sees all offers, mentor sees own) |
| POST | /api/problems/:id/offers | verified senior/alumni | `{message}` offer help (one per problem) |
| POST | /api/problems/:id/resolve | owner | `{mentor_id?}` mark resolved, credits the helper (+15) |
| POST | /api/problems/:id/close | owner | Close without resolving |
| POST | /api/requests | verified | `{mentor_id, goal, message, problem_id?}` |
| GET | /api/requests?box=incoming\|outgoing | any | My requests |
| POST | /api/requests/:id/respond | the mentor | `{decision: accept\|decline, decline_reason, alternative_slot_at?}` |
| POST | /api/requests/:id/cancel | the student | Cancel a pending or active request |
| POST | /api/requests/:id/complete | the mentor | End an accepted mentorship |

## Rules
- Only verified accounts post, offer or request. Max 10 open problems, 5 topics per problem, 5 pending requests per person.
- The board shows only problems from the viewer's university, hides the name of anonymous askers, and respects "preferred mentor type".
- A request needs a verified, active mentor of the same university who is accepting, not paused and below the mentee limit. One active request per student and mentor pair. Mentor row is locked during the check so the last free place cannot be taken twice.
- Accepting re-checks capacity inside a transaction, sets `responded_at`, moves a linked problem to "in discussion" and refreshes the mentor's cached stats (mentee count, response time).
- Resolving a problem with a helper adds +15 credits once (row-locked status change), via `src/credits.js`.
- Every step writes a notification for the other person (shown in the notification centre in Module 8).

## Test it
1. Log in as a verified student, open Problems, post a problem with two topics.
2. Log in as a verified senior/alumni (tick matching "I can mentor" topics in Module 3). Open Problems, the board shows it with "Matches your expertise". Open it and send an offer. A second offer must be refused.
3. As the student: reopen the problem, see the offer, click Request mentorship, send the request.
4. As the mentor: Requests > Sent to me. Decline once with a reason (try a suggested time), then have the student send another request and Accept.
5. Check `SELECT * FROM mentorship_requests;`, `SELECT * FROM mentor_stats;` (active_mentees = 1) and `SELECT * FROM notifications;`.
6. As the student click "This solved it" on the offer and check `credit_transactions` (+15) and that the mentor's `problems_resolved` is 1.
7. Pause the mentor in their profile: sending a new request must say not accepting.


---
# Module 6: Sessions and reviews

A mentor schedules sessions inside an accepted mentorship. Both sides can cancel before the start. After the session the mentor marks it completed, and both people leave a review. Uses `sessions` and `reviews`. No database changes.

## Upgrade from Module 5
Copy the new/changed files over your project (or use this folder), then restart `npm start`. Banner version: `student-assist@0.6.0`. No new packages.

New files: `src/routes/sessions.js`, `src/routes/reviews.js`, `public/sessions.html`, `public/js/sessions.js`.
Changed files: `server.js`, `public/js/requests.js` (Schedule / View sessions buttons), `public/dashboard.html` (Sessions link), `public/user.html` and `public/js/user.js` (reviews on a mentor's profile).

## Flow
1. Mentor opens Requests > Sent to me > **Schedule session** on an accepted request.
2. Picks date and time, length (30 to 90 min), mode and the meeting link (https) or place. The first session moves the request to "In progress".
3. After the session ends the mentor clicks **Mark completed** (+10 credits). The student can then rate (1 to 5, plus helpfulness, clarity, responsiveness, comment). A rating of 4 or 5 gives the mentor +5 credits. The mentor can leave short written feedback on the student.
4. If someone does not show up, wait 10 minutes after the start, then report it. A mentor no-show costs the mentor 10 credits. A mentee no-show has no credit effect.

## API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | /api/sessions | the mentor | `{request_id, start: "YYYY-MM-DDTHH:MM", duration_minutes, mode, meeting_link}` |
| GET | /api/sessions/mine?scope=upcoming\|past | any | My sessions with action flags and visible reviews |
| POST | /api/sessions/:id/status | participants | `{status: cancelled \| completed \| mentee_no_show \| mentor_no_show}` |
| POST | /api/sessions/:id/review | participants | Mentee: `{rating, helpfulness?, clarity?, responsiveness?, comment?}`. Mentor: `{comment}` |
| GET | /api/reviews/mentor/:id | any, same university | Average ratings and the latest 20 visible reviews |

## Rules
- Only the mentor of an accepted or in-progress mentorship schedules. Start must be in the future and at most 90 days ahead.
- No overlap: neither the mentor nor the student may already have a scheduled session in that time.
- If the time fits inside one of the mentor's active availability slots (same weekday, time and mode), the session is linked to that slot.
- Cancel only before the start. Mark completed only after the end time, and only by the mentor.
- One review per person per session (database unique key). Reviews are allowed only on completed sessions.
- Credits are written once per session or review inside a locked transaction. After each change the mentor's cached stats (sessions completed, average rating, badges such as First Session) are recomputed.
- Reviews with `is_hidden` set (Module 8 moderation) are not shown and are not counted in the average.

## Test it
1. Use a mentor and student with an accepted request (Module 5).
2. As the mentor: Requests > Schedule session for a time a few minutes from now with a 30 minute length. Try the same time again for a second request or the same one: it must be refused as an overlap.
3. As the student: Sessions > Upcoming shows it. Cancel works only before it starts.
4. After the end time, as the mentor click Mark completed. Check `credit_transactions` (+10) and `mentor_stats.sessions_completed`, and that the FIRST_SESSION badge is in `user_badges`.
5. As the student: Past > Leave a review with 5 stars. Check `reviews`, the extra +5 credit row, and `mentor_stats.avg_rating`. Reviewing again must say "already reviewed".
6. Open the mentor's profile (`user.html?id=`): the review appears with the first name of the reviewer.
7. To test without waiting, edit the times directly: `UPDATE sessions SET scheduled_start = DATE_SUB(NOW(), INTERVAL 2 HOUR), scheduled_end = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE session_id = 1;`
