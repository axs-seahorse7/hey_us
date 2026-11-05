import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import authRouter from './routes/auth.routes.js';
import folderRouter from './routes/folder.routes.js';
import galleryRoutes from "./routes/galary.routes.js"
import mediaRoutes from './routes/media.routes.js';

const app = express();

const allowedOrigin = [
  'https://hoppscotch.io',
  'http://localhost:5173',
  'http://10.134.64.36:5173',
  'http://10.92.243.36:5173',
];

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

app.use(express.json());
app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'dear-us-api' }));

// CHECK WHICH ROUTE IS HIT BY USER
app.use((request, _response, next) => {
  console.log(`Incoming request: ${request.method} ${request.originalUrl}`);
  next();
});


app.use('/api/auth', authRouter);
app.use('/api/folders', folderRouter);
app.use('/api/gallery', galleryRoutes);
app.use('/api/media', mediaRoutes);


app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT ?? 4000;

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Add it to server/.env.');
  if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
  app.listen(port, () => console.log(`Dear Us API listening on port ${port}`));
}

start().catch((error) => { console.error(error); process.exit(1); });
