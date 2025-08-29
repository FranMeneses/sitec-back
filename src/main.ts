import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS para Vercel
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Configurar el puerto para Vercel
  const port = process.env.PORT || 4000;
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  }
  
  return app;
}

// Para Vercel serverless
const app = bootstrap();

export default app;
