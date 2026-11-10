// Usage: node scripts/create-admin.js "Full Name" admin@demo.edu.in "StrongPass1"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: node scripts/create-admin.js "Full Name" email password');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const [r] = await db.query(
    `INSERT INTO users (university_id, role, full_name, email, password_hash, email_verified_at, verification_status)
     VALUES (1, 'admin', ?, ?, ?, NOW(), 'verified')`, [name, email.toLowerCase(), hash]);
  await db.query('INSERT INTO profiles (user_id) VALUES (?)', [r.insertId]);
  await db.query("INSERT INTO role_history (user_id, old_role, new_role) VALUES (?, NULL, 'admin')", [r.insertId]);
  console.log(`Admin created with user_id ${r.insertId}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
