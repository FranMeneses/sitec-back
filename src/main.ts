import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS para producción
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://frontsanpedro.vercel.app',
      'http://localhost:3000', // Para desarrollo local
      'http://localhost:5173'  // Para Vite/otros dev servers
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Configurar headers de seguridad para COOP
  app.use((req, res, next) => {
    // Permitir popups para Google OAuth
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  
  // Configurar el puerto para Render
  const port = process.env.PORT || 4000;
  
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
  
  return app;
}

bootstrap();
