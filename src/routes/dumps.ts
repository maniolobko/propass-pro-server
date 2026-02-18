import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all dumps
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const dumps = await prisma.dump.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: dumps });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload dump
router.post('/upload', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, data, hash } = req.body;

    const dump = await prisma.dump.create({
      data: {
        client_id,
        data: JSON.stringify(data),
        hash,
        uploaded_by: req.user?.username || 'system'
      }
    });

    res.json({ success: true, data: dump });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
