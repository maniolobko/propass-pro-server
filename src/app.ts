import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import dumpRoutes from './routes/dumps';
import copiesRoutes from './routes/copies';
import quotasRoutes from './routes/quotas';
import syncRoutes from './routes/sync';

// Import middleware
import { authenticateJWT } from './middleware/auth';

dotenv.config();

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes (public)
app.use('/api/auth', authRoutes);

// Routes (protected)
app.use('/api/clients', authenticateJWT, clientRoutes);
app.use('/api/dumps', authenticateJWT, dumpRoutes);
app.use('/api/copies', authenticateJWT, copiesRoutes);
app.use('/api/quotas', authenticateJWT, quotasRoutes);
app.use('/api/sync', authenticateJWT, syncRoutes);

// Error handling
app.use((err: any, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

export { app };
