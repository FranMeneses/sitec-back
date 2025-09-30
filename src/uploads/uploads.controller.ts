import { Controller, Post, Get, UseInterceptors, UploadedFile, Body, UseGuards, Request, Param, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller('uploads')
export class UploadsController {
  private readonly uploadsPath: string;

  constructor(private uploadsService: UploadsService) {
    // Configurar ruta de uploads según el entorno detectado por VM_DEPLOYMENT
    if (process.env.VM_DEPLOYMENT === 'true') {
      // VM de producción - usar ruta del container
      this.uploadsPath = '/app/uploads/current';
    } else {
      // Render o desarrollo local - usar ruta relativa
      this.uploadsPath = join(process.cwd(), 'uploads', 'current');
    }
  }

  private getUploadsPath(): string {
    return this.uploadsPath;
  }

  @Post('evidence')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        let uploadPath: string;
        if (process.env.VM_DEPLOYMENT === 'true') {
          uploadPath = '/app/uploads/current';
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
    console.log('🔍 downloadEvidence - evidenceId:', evidenceId);
    
    // Verificar permisos y obtener información del archivo
    const evidence = await this.uploadsService.getEvidenceForDownload(evidenceId, req.user.id);
    
    console.log('🔍 Evidence data:', {
      filename: evidence.filename,
      originalName: evidence.originalName,
      mimeType: evidence.mimeType
    });
    
    // Construir ruta del archivo usando la ruta configurada
    const filePath = join(this.getUploadsPath(), evidence.filename);
    
    // Verificar que el archivo existe
    if (!existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    
    // Configurar headers para descarga
    const contentDisposition = `attachment; filename="${evidence.originalName}"`;
    console.log('🔍 Setting Content-Disposition:', contentDisposition);
    
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Type', evidence.mimeType);
    
    // Enviar archivo
    res.sendFile(filePath);
  }
}