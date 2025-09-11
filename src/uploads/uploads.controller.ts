import { Controller, Post, Get, UseInterceptors, UploadedFile, Body, UseGuards, Request, Param, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller('uploads')
export class UploadsController {
  private readonly uploadsPath!: string;

  constructor(private uploadsService: UploadsService) {
    // Configurar ruta de uploads según el entorno
    if (process.env.NODE_ENV === 'production' && process.env.RENDER === undefined) {
      // VM de producción - usar ruta absoluta de la VM
      this.uploadsPath = '/var/www/sitec/uploads/current';
    } else {
      // Render o desarrollo local - usar ruta relativa
      this.uploadsPath = join(process.cwd(), 'uploads', 'current');
    }
  }

  private getUploadsPath(): string {
    if (this.uploadsPath) {
      return this.uploadsPath;
    }
    return join(process.cwd(), 'uploads', 'current');
  }

  @Post('evidence')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        let uploadPath: string;
        if (process.env.NODE_ENV === 'production' && process.env.RENDER === undefined) {
          uploadPath = '/var/www/sitec/uploads/current';
        } else {
          uploadPath = join(process.cwd(), 'uploads', 'current');
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        // El nombre del archivo se manejará en el servicio
        cb(null, file.originalname);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido'), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    }
  }))
  async uploadEvidence(
    @UploadedFile() file: Express.Multer.File,
    @Body('taskId') taskId: string,
    @Request() req: any,
  ) {
    return this.uploadsService.uploadEvidenceFile(file, taskId, req.user.id);
  }

  @Get('evidence/:evidenceId')
  @UseGuards(JwtAuthGuard)
  async downloadEvidence(
    @Param('evidenceId') evidenceId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    // Verificar permisos y obtener información del archivo
    const evidence = await this.uploadsService.getEvidenceForDownload(evidenceId, req.user.id);
    
    // Construir ruta del archivo usando la ruta configurada
    const filePath = join(this.getUploadsPath(), evidence.filename);
    
    // Verificar que el archivo existe
    if (!existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    
    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalName}"`);
    res.setHeader('Content-Type', evidence.mimeType);
    
    // Enviar archivo
    res.sendFile(filePath);
  }
}
