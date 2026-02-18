import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get quota for client
router.get('/:client_id', async (req: AuthRequest, res: Response) => {
  try {
    const quota = await prisma.quota.findUnique({
      where: {
        client_id: parseInt(req.params.client_id)
      }
    });

    if (!quota) {
      return res.status(404).json({ error: 'Quota not found' });
    }

    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update quota
router.put('/:client_id', async (req: AuthRequest, res: Response) => {
  try {
    const { monthly_limit, remaining } = req.body;

    const quota = await prisma.quota.update({
      where: { client_id: parseInt(req.params.client_id) },
      data: { monthly_limit, remaining }
    });

    res.json({ success: true, data: quota });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
