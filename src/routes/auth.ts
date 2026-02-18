import { Router, Request, Response } from 'express';
import jwt from 'jwt-simple';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, device_id } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token (expires in 7 days)
    const token = jwt.encode(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        device_id: device_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      },
      SECRET
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token, device_id } = req.body;
    const decoded = jwt.decode(token, SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = jwt.encode(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        device_id: device_id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      },
      SECRET
    );

    res.json({ success: true, token: newToken });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user
router.get('/me', async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
