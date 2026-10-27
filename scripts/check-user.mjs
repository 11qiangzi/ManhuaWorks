/**
 * Quick script to check DB + verify/create test user
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/manhuaworks',
});

async function main() {
  try {
    // Check existing users
    const { rows: users } = await pool.query('SELECT id, email, display_name FROM users');
    console.log('Existing users:', JSON.stringify(users, null, 2));

    if (users.length === 0) {
      // Create a fresh test user
      const hash = bcrypt.hashSync('test123456', 4); // low cost for speed
      const { rows: [newUser] } = await pool.query(
        `INSERT INTO users (email, display_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, display_name`,
        ['test@manhua.local', '测试账号', hash, 2, 1]
      );
      console.log('Created test user:', JSON.stringify(newUser, null, 2));
      console.log('Login with: test@manhua.local / test123456');
    } else {
      // Try to verify demo-creator password
      const { rows: [demo] } = await pool.query(
        "SELECT id, email, display_name, password_hash FROM users WHERE email = 'demo-creator@manhuaworks.local'"
      );
      if (demo) {
        const match = bcrypt.compareSync('Test1234!', demo.password_hash);
        console.log(`demo-creator password match Test1234!: ${match}`);
        if (!match) {
          // Reset password
          const newHash = bcrypt.hashSync('test123456', 4);
          await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, demo.id]);
          console.log('Reset demo-creator password to: test123456');
        }
      }
    }
  } catch (err) {
    console.error('Error:', (err as Error).message);
  } finally {
    await pool.end();
  }
}

main();
