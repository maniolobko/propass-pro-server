import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import jwt from 'jwt-simple';

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthenticatedWebSocket extends WebSocket {
  isAlive?: boolean;
  user?: { id: number; username: string; role: string };
}

const clients = new Map<string, AuthenticatedWebSocket[]>();

export function setupWebSocket(server: http.Server, prisma: PrismaClient) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    console.log('🔌 WebSocket client connected');

    // Authenticate client
    const token = new URL(`http://localhost${req.url}`).searchParams.get('token');
    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }

    try {
      const decoded = jwt.decode(token, SECRET);
      ws.user = decoded;
    } catch (error) {
      ws.close(1008, 'Invalid token');
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Add client to room (by device_id)
    const room = (ws.user as any)?.device_id || 'main';
    if (!clients.has(room)) {
      clients.set(room, []);
    }
    clients.get(room)!.push(ws);

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket message:', message.type);

        if (message.type === 'copy_completed') {
          // Broadcast copy completion to all admin clients
          broadcastToAdmins({
            type: 'copy_completed',
            data: message.payload
          });
        }

        if (message.type === 'sync_request') {
          // Send current quota
          const quotas = await prisma.quota.findMany();
          ws.send(
            JSON.stringify({
              type: 'sync_response',
              data: quotas
            })
          );
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      const room = (ws.user as any)?.device_id || 'main';
      const roomClients = clients.get(room);
      if (roomClients) {
        const index = roomClients.indexOf(ws);
        if (index > -1) {
          roomClients.splice(index, 1);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Heartbeat
  setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
}

function broadcastToAdmins(message: any) {
  clients.forEach((roomClients) => {
    roomClients.forEach((client) => {
      if (client.user?.role === 'admin' && client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  });
}

export { broadcastToAdmins };
