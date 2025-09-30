import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { UploadResponse } from './entities/upload.entity';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class UploadsService {
  private readonly uploadsPath: string;
  private readonly historicPath: string;

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {
    // Configurar rutas según el entorno detectado por VM_DEPLOYMENT
    if (process.env.VM_DEPLOYMENT === 'true') {
      // VM de producción - usar rutas del container que mapean al host
      this.uploadsPath = join('/app', 'uploads', 'current');
      this.historicPath = join('/app', 'uploads', 'history');
    } else if (process.env.RENDER !== undefined) {
      // Render - usar rutas relativas
      this.uploadsPath = join(process.cwd(), 'uploads', 'current');
      this.historicPath = join(process.cwd(), 'uploads', 'historic');
    } else {
      // Desarrollo local - usar rutas relativas
      this.uploadsPath = join(process.cwd(), 'uploads', 'current');
      this.historicPath = join(process.cwd(), 'uploads', 'historic');
    }

    // Inicializar directorios según el entorno
    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    if (process.env.VM_DEPLOYMENT === 'true') {
      // VM: Solo verificar que existen, NO crear
      this.verifyVMDirectories();
    } else {
      // Render/Desarrollo: Crear si no existen
      this.ensureDirectoriesExist();
    }
  }

  private verifyVMDirectories(): void {
    console.log('🔍 Verificando directorios en VM...');
    
    if (!existsSync(this.uploadsPath)) {
      throw new Error(`❌ Directorio de uploads no encontrado: ${this.uploadsPath}. 
        Las carpetas deben existir en el host y estar mapeadas correctamente.`);
    }

    if (!existsSync(this.historicPath)) {
      throw new Error(`❌ Directorio histórico no encontrado: ${this.historicPath}. 
        Las carpetas deben existir en el host y estar mapeadas correctamente.`);
    }

    console.log(`✅ Directorio de uploads verificado: ${this.uploadsPath}`);
    console.log(`✅ Directorio histórico verificado: ${this.historicPath}`);
  }

  private ensureDirectoriesExist(): void {
    console.log('📁 Creando directorios si no existen...');
    
    try {
      if (!existsSync(this.uploadsPath)) {
        mkdirSync(this.uploadsPath, { recursive: true });
        console.log(`✅ Directorio de uploads creado: ${this.uploadsPath}`);
      } else {
        console.log(`✅ Directorio de uploads encontrado: ${this.uploadsPath}`);
      }

      if (!existsSync(this.historicPath)) {
        mkdirSync(this.historicPath, { recursive: true });
        console.log(`✅ Directorio histórico creado: ${this.historicPath}`);
      } else {
        console.log(`✅ Directorio histórico encontrado: ${this.historicPath}`);
      }
    } catch (error) {
      console.error('❌ Error manejando directorios de uploads:', error);
      throw new Error(`No se pudieron inicializar los directorios de uploads: ${error.message}`);
    }
  }

  async uploadEvidenceFile(
    file: Express.Multer.File,
    taskId: string,
    uploaderId: string,
  ): Promise<UploadResponse> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Validar permisos: puede ser project_member o task_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: task.process.idproject,
        iduser: uploaderId,
      },
    });

    const isTaskMember = await this.userService.isTaskMember(uploaderId, taskId);

    if (!projectMember && !isTaskMember) {
      throw new ForbiddenException('No tienes permisos para subir evidencias en esta tarea');
    }

    // Crear el registro de evidencia primero para obtener el ID
    const evidence = await this.prisma.evidence.create({
      data: {
        idtask: taskId,
        link: '', // Se actualizará después
        iduploader: uploaderId,
        uploadedat: new Date(),
      },
    });

    // Usar el nombre original del archivo (sin UUID)
    const filename = file.originalname;
    const fileUrl = `/uploads/current/${filename}`;

    try {
      // Actualizar el registro de evidencia con la ruta del archivo
      await this.prisma.evidence.update({
        where: { id: evidence.id },
        data: { link: fileUrl },
      });

      // Crear log de actividad
      await this.prisma.logs.create({
        data: {
          type: 'EVIDENCE_UPLOADED',
          idcreator: uploaderId,
          idtask: taskId,
          idprocess: task.idprocess,
          idproject: task.process.idproject || undefined,
          createdat: new Date(),
        },
      });

      return {
        evidenceId: evidence.id,
        filename: filename,
        originalName: file.originalname,
        filePath: fileUrl,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: evidence.uploadedat || new Date(),
      };

    } catch (error) {
      // Si hay error, eliminar el registro de evidencia
      await this.prisma.evidence.delete({
        where: { id: evidence.id },
      });
      
      throw new BadRequestException(`Error al guardar el archivo: ${error.message}`);
    }
  }

  async getEvidenceForDownload(evidenceId: string, userId: string): Promise<any> {
    // Verificar que la evidencia existe y el usuario tiene permisos
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { 
        task: { 
          include: { 
            process: { 
              include: { project: true } 
            } 
          } 
        } 
      },
    });

    if (!evidence) {
      throw new BadRequestException('La evidencia no existe');
    }

    // Validar permisos
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: evidence.task.process.idproject,
        iduser: userId,
      },
    });

    const isTaskMember = await this.userService.isTaskMember(userId, evidence.task.id);

    if (!projectMember && !isTaskMember) {
      throw new ForbiddenException('No tienes permisos para descargar esta evidencia');
    }

    // Extraer nombre del archivo de la ruta
    const filename = evidence.link.split('/').pop() || '';
    
    // Como ya no usamos UUID en el nombre, el filename ES el nombre original
    const originalName = filename;

    return {
      filename,
      originalName,
      mimeType: this.getMimeTypeFromExtension(filename),
    };
  }

  private getMimeTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return ext ? (mimeTypes[ext] || 'application/octet-stream') : 'application/octet-stream';
  }

  async deleteEvidenceFile(evidenceId: string, userId: string): Promise<boolean> {
    // Verificar que la evidencia existe y el usuario tiene permisos
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { 
        task: { 
          include: { 
            process: { 
              include: { project: true } 
            } 
          } 
        } 
      },
    });

    if (!evidence) {
      throw new BadRequestException('La evidencia no existe');
    }

    // Validar permisos
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: evidence.task.process.idproject,
        iduser: userId,
      },
    });

    const isTaskMember = await this.userService.isTaskMember(userId, evidence.task.id);

    if (!projectMember && !isTaskMember && evidence.iduploader !== userId) {
      throw new ForbiddenException('No tienes permisos para eliminar esta evidencia');
    }

    // Eliminar archivo físico de la carpeta actual
    const filePath = join(this.uploadsPath, evidence.link.split('/').pop() || '');
    
    if (existsSync(filePath)) {
      const fs = require('fs');
      fs.unlinkSync(filePath);
    }

    // Eliminar registro de la base de datos
    await this.prisma.evidence.delete({
      where: { id: evidenceId },
    });

    return true;
  }
}