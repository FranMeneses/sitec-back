const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');

let app;

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

module.exports = async function handler(req, res) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  
  return expressApp(req, res);
};
