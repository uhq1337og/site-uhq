const { createClient } = require('redis');

let client = null;
let connected = false;

const createRedisClient = async () => {
  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', err => console.error('Redis error:', err));

    await client.connect();
    connected = true;
    console.log('Connected to Redis');
  } catch (err) {
    console.warn('Failed to connect to Redis, using file fallback:', err.message);
    connected = false;
  }
};

// Initialize connection
createRedisClient();

module.exports = { client: () => client, isConnected: () => connected };
