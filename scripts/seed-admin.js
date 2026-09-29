/**
 * Creates (or updates the password of) a super_admin account so there's
 * a way into the admin console before any other staff exist.
 *
 * Usage:
 *   node scripts/seed-admin.js "Ops Admin" admin@qcab.co.uk "a-strong-password"
 *
 * Requires DATABASE_URL in the environment (source your .env first).
 */
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const [fullName, email, password] = process.argv.slice(2);
  if (!fullName || !email || !password) {
    console.error('Usage: node scripts/seed-admin.js "<full name>" <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    await client.query('UPDATE users SET password_hash = $1, role = $2, status = $3 WHERE email = $4', [
      passwordHash,
      'super_admin',
      'active',
      email,
    ]);
    console.log(`Updated existing user ${email} to super_admin with a new password.`);
  } else {
    await client.query(
      `INSERT INTO users (role, full_name, email, phone_number, password_hash, status)
       VALUES ('super_admin', $1, $2, $3, $4, 'active')`,
      [fullName, email, `+00000${Math.floor(Math.random() * 100000)}`, passwordHash],
    );
    console.log(`Created super_admin ${email}.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
