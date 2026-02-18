import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Sync push - client sends offline data
router.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const { device_id, queue } = req.body;

    // Process each item in queue
    const results = [];
    for (const item of queue) {
      try {
        if (item.type === 'copy') {
          const copy = await prisma.copy.create({
            data: {
              client_id: item.payload.client_id,
              uid: item.payload.uid,
              status: item.payload.status,
              device_id
            }
          });
          results.push({ id: item.id, status: 'synced', data: copy });
        }
      } catch (error) {
        results.push({ id: item.id, status: 'failed', error: (error as any).message });
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync pull - client gets latest data
router.get('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      include: { quotas: true, badges: true }
    });

    res.json({
      success: true,
      data: {
        clients,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
