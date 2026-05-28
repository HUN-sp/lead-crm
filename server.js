const app = require('./src/app');
const { initCache } = require('./src/utils/cache');

const PORT = process.env.PORT || 3000;

async function start() {
  await initCache(); // Connect to Redis (or fall back to memory)
  app.listen(PORT, () => {
    console.log(`🚀 Lead CRM API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
