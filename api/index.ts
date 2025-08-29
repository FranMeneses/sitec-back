import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let app: any;

async function bootstrap() {
  if (!app) {
    const expressApp = express();
    
    app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );
    
    // Configurar CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });
    
    await app.init();
  }
  
  return app;
}

export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  
  return expressApp(req, res);
}
