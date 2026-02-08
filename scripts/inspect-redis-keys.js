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
      console.error('Redis not available. Set REDIS_URL or start Redis and retry.');
      process.exit(1);
    }

    const patterns = ['user:*', 'username:*', 'email:*'];
    const seen = new Set();
    for (const p of patterns) {
      const keys = await client.keys(p);
      for (const k of keys) seen.add(k);
    }

    if (seen.size === 0) {
      console.log('No matching keys found');
      await client.quit();
      process.exit(0);
    }

    for (const key of Array.from(seen).sort()) {
      try {
        const type = await client.type(key);
        let sample = null;
        if (type === 'hash') sample = await client.hGetAll(key);
        else if (type === 'string') sample = await client.get(key);
        else if (type === 'list') sample = await client.lRange(key, 0, 9);
        else if (type === 'set') sample = await client.sMembers(key);
        else if (type === 'zset') sample = await client.zRangeWithScores(key, 0, 9);
        else sample = '<no-preview>';

        console.log(JSON.stringify({ key, type, sample }, null, 2));
      } catch (e) {
        console.error('Error reading key', key, e.message);
      }
    }

    await client.quit();
    process.exit(0);
  } catch (err) {
    console.error('Inspect error:', err.message);
    process.exit(1);
  }
})();
