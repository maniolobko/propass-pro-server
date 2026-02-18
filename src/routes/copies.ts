import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Record copy operation
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, uid, status, device_id } = req.body;

    const copy = await prisma.copy.create({
      data: {
        client_id,
        uid,
        status,
        device_id,
        recorded_by: req.user?.username || 'system'
      }
    });

    res.json({ success: true, data: copy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get copy history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const copies = await prisma.copy.findMany({
      orderBy: { created_at: 'desc' },
      take: 100
    });
    res.json({ success: true, data: copies });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
