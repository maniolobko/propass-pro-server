import dotenv from 'dotenv';
import http from 'http';
import { PrismaClient } from '@prisma/client';

import { app } from './app';

// Import WebSocket handler
import { setupWebSocket } from './websocket/handler';

dotenv.config();

const server = http.createServer(app);
const prisma = new PrismaClient();
// WebSocket setup (not used in serverless)
setupWebSocket(server, prisma);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════╗
  ║  PROPASS PRO - Central Server      ║
  ║  🚀 Running on port ${PORT}          ║
  ║  🔐 JWT Authentication Ready       ║
  ║  📡 WebSocket Sync Active          ║
  ║  🗄️  PostgreSQL Connected           ║
  ╚════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export { app, server, prisma };
