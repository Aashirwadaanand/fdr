import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';

const PORT = process.env.PORT || 5000;
const app = createApp();

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🛡️  AICTE FDR-Sentinel Portal Server running on http://localhost:${PORT}`);
    console.log(`📚 OpenAPI / Swagger Documentation available at http://localhost:${PORT}/api/docs`);
    console.log(`🕒 Demo Clock initialized to standard baseline`);
    console.log(`================================================================`);
  });
}

export default app;

