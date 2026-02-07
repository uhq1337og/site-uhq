const redis = require('./redis-client');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

(async () => {
  try {
    // Read users from JSON file
    if (!fs.existsSync(USERS_FILE)) {
      console.log('No users.json file found');
      await redis.quit();
      process.exit(0);
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    console.log(`Migrating ${users.length} users to Redis...`);

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const userId = u.userId || u.user_id;
      
      // Store user data as hash
      await redis.hSet(`user:${userId}`, {
        user_id: userId,
        username: u.user || u.username || '',
        email: u.email || '',
        password: u.pass || u.password || '',
        created_at: u.createdAt || u.created_at || new Date().toISOString()
      });

      // Store user role
      const role = i === 0 ? 'admin' : (u.role || 'user');
      await redis.set(`user:${userId}:role`, role);

      // Store username -> userId mapping for lookups
      await redis.set(`username:${u.user || u.username}`, userId);
      await redis.set(`email:${u.email}`, userId);
    }

    console.log('Migration to Redis complete');
    await redis.quit();
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
