import { createServer } from 'node:http';
import { env } from './config/env';
import { connectDb, disconnectDb } from './db';
import { createApp } from './app';
import { initSocket } from './socket';

async function main() {
  await connectDb(env.MONGODB_URI);
  const server = createServer(createApp());
  const io = initSocket(server);
  server.listen(env.PORT, () => console.log(`[api] listening on http://localhost:${env.PORT}`));

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    io.close();
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
