let createClient;
try {
  // Try to require redis; may fail if node_modules is broken or redis not installed
  ({ createClient } = require('redis'));
} catch (err) {
  console.warn('Redis module not available:', err.message);
  createClient = null;
}

let client = null;
let connected = false;

const createRedisClient = async () => {
  if (!createClient) {
    connected = false;
    return;
  }

  try {
    client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    client.on('error', err => console.error('Redis error:', err));
    await client.connect();
    connected = true;
    console.log('Connected to Redis');
  } catch (err) {
    console.warn('Failed to connect to Redis, using file fallback:', err.message);
    connected = false;
    client = null;
  }
};

// Initialize connection (best-effort)
createRedisClient();

async function safeQuit() {
  try {
    if (client && typeof client.quit === 'function') await client.quit();
  } catch (e) {
    // ignore
  }
}

module.exports = { client: () => client, isConnected: () => connected, quit: safeQuit };
