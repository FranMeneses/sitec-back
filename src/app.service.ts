import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  // Ejemplo de método para verificar la conexión a la base de datos
  async checkDatabaseConnection(): Promise<string> {
    try {
      // Este query funcionará incluso con una base de datos vacía
      await this.prisma.$queryRaw`SELECT 1`;
      return 'Database connection successful!';
    } catch (error) {
      return `Database connection failed: ${error.message}`;
    }
  }
}
