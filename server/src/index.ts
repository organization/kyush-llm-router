import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import adminRoutes from './routes/admin';
import apiRoutes from './routes/api';
import analyticsRoutes from './routes/analytics';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());

app.use('/admin', adminRoutes);
app.use('/v1', apiRoutes);
app.use('/admin/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Admin API: http://localhost:${PORT}/admin`);
  logger.info(`OpenAI API: http://localhost:${PORT}/v1`);
});
