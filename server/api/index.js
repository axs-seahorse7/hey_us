
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

import authRouter from './routes/auth.routes.js';
import folderRouter from './routes/folder.routes.js';
import galleryRoutes from './routes/galary.routes.js';
import mediaRoutes from './routes/media.routes.js';
import privateAlbumRoutes from './routes/privateAlbum.routes.js';
import recycleBinRoutes from './routes/recycleBin.routes.js';

const app = express();

// Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://10.92.243.36:5173',
  'http://192.168.19.117:5173',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dear-us-api',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Request logging
app.use((req, _res, next) => {
  console.log(`Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// Cached MongoDB connection
let connectionPromise = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    }).catch(error => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
}

// Ensure database is connected before API routes execute
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/folders', folderRouter);
app.use('/api/gallery', galleryRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/private-album', privateAlbumRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler
app.use((error, _req, res, _next) => {
  console.error(error);

  res.status(error.message?.startsWith('CORS blocked') ? 403 : 500).json({
    message: 'Something went wrong. Please try again.',
  });
});

// Vercel serverless entry point
export default app;
