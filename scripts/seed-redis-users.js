const redisModule = require('../redis-client');

async function waitForRedis(timeout = 5000) {
  const start = Date.now();
  while (!redisModule.isConnected()) {
    if (Date.now() - start > timeout) return false;
    await new Promise(r => setTimeout(r, 100));
  }
  return true;
}

(async () => {
  try {
    const ready = await waitForRedis(5000);
    const client = redisModule.client();
    if (!ready || !client) {
      console.error('Redis not available. Start the app with Redis or check REDIS_URL.');
      process.exit(1);
    }

    const users = [
      { userId: 'USER_TEST1', user: 'alice', email: 'alice@example.com', role: 'admin' },
      { userId: 'USER_TEST2', user: 'bob', email: 'bob@example.com', role: 'moderator' },
      { userId: 'USER_TEST3', user: 'carol', email: 'carol@example.com', role: 'user' }
    ];

    for (const u of users) {
      await client.hSet(`user:${u.userId}`, {
        user_id: u.userId,
        username: u.user,
        email: u.email,
        password: 'changeme',
        created_at: new Date().toISOString()
      });

      await client.set(`user:${u.userId}:role`, u.role);
      await client.set(`username:${u.user.toLowerCase()}`, u.userId);
      await client.set(`email:${u.email}`, u.userId);
    }

    console.log('Seeded Redis with test users.');
    await client.quit();
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
})();
