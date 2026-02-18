import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all clients
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      include: { quotas: true }
    });
    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single client
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { quotas: true, badges: true }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create client
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, balance } = req.body;

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        balance: balance || 0
      }
    });

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, balance } = req.body;

    const client = await prisma.client.update({
      where: { id: parseInt(req.params.id) },
      data: { name, email, phone, balance }
    });

    res.json({ success: true, data: client });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.client.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.json({ success: true, message: 'Client deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// Recharge client badge balance
router.post('/:id/reload', async (req: AuthRequest, res: Response) => {
  try {
    const { amount, description } = req.body;
    const clientId = parseInt(req.params.id);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Update client balance
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    // Log the copy/reload operation
    const copy = await prisma.copy.create({
      data: {
        client_id: clientId,
        uid: `reload-${Date.now()}`,
        status: 'completed',
        device_id: req.user?.username || 'system',
        recorded_by: req.user?.username || 'system'
      }
    });

    res.json({
      success: true,
      message: `Balance rechargée de ${amount}€`,
      data: {
        client,
        reload: {
          id: copy.id,
          amount,
          description,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
export default router;
