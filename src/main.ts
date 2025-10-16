import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'], // Reducir logs en producción si es necesario
    });
    
    // Configurar CORS para producción
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://frontsanpedro.vercel.app',
      'https://eic-proyectos.ucn.cl',
      'http://localhost:3000', // Para desarrollo local
      'http://localhost:5173'  // Para Vite/otros dev servers
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'x-apollo-operation-name',
      'apollo-require-preflight'
    ],
  });

  // Configurar headers de seguridad para COOP
  app.use((req, res, next) => {
    // Permitir popups para Google OAuth
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Configurar charset UTF-8 para manejar caracteres especiales
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });
  
  // Configurar el puerto para Render
  const port = process.env.PORT || 4000;
  
    await app.listen(port);
    console.log(`Application is running on port: ${port}`);
    
    return app;
  } catch (error) {
    console.error('Error during application startup:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
