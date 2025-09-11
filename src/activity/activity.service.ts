import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { Evidence } from './entities/evidence.entity';
import { Comment } from './entities/comment.entity';
import { Logs } from './entities/logs.entity';
import { CreateEvidenceInput, UpdateEvidenceInput } from './dto/evidence.dto';
import { CreateCommentInput, UpdateCommentInput } from './dto/comment.dto';
import { CreateLogInput, LogType } from './dto/logs.dto';

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  // ==================== EVIDENCE METHODS ====================

  async findAllEvidence(userId?: string): Promise<Evidence[]> {
    const evidence = await this.prisma.evidence.findMany({
      include: {
        task: true,
        user: true, // uploader
      },
      orderBy: { uploadedat: 'desc' },
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }

  async findEvidenceById(id: string): Promise<Evidence | null> {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        task: true,
        user: true, // uploader
      },
    });

    if (!evidence) return null;
    return this.mapEvidence(evidence);
  }

  async findEvidenceByTask(taskId: string): Promise<Evidence[]> {
    const evidence = await this.prisma.evidence.findMany({
      where: { idtask: taskId },
      include: {
        task: true,
        user: true, // uploader
      },
      orderBy: { uploadedat: 'desc' },
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }

  async createEvidence(createEvidenceInput: CreateEvidenceInput, uploaderId: string): Promise<Evidence> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: createEvidenceInput.taskId },
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

    const isTaskMember = await this.userService.isTaskMember(uploaderId, createEvidenceInput.taskId);

    if (!projectMember && !isTaskMember) {
      throw new ForbiddenException('No tienes permisos para subir evidencias en esta tarea');
    }

    // Si no se proporciona un link, error
    if (!createEvidenceInput.link) {
      throw new BadRequestException('Debe proporcionar un link');
    }

    const evidence = await this.prisma.evidence.create({
      data: {
        idtask: createEvidenceInput.taskId,
        link: createEvidenceInput.link,
        iduploader: uploaderId,
        uploadedat: new Date(),
        review: createEvidenceInput.review,
      },
      include: {
        task: true,
        user: true, // uploader
      },
    });

    // Crear log de actividad
    await this.createLog({
      type: LogType.EVIDENCE_UPLOADED,
      taskId: createEvidenceInput.taskId,
      processId: task.idprocess,
      projectId: task.process.idproject || undefined,
    }, uploaderId);

    return this.mapEvidence(evidence);
  }

  async updateEvidence(updateEvidenceInput: UpdateEvidenceInput, userId: string): Promise<Evidence> {
    // Validar que la evidencia existe
    const existingEvidence = await this.prisma.evidence.findUnique({
      where: { id: updateEvidenceInput.id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });
    if (!existingEvidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingEvidence.task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para editar esta evidencia');
    }

    const evidence = await this.prisma.evidence.update({
      where: { id: updateEvidenceInput.id },
      data: {
        link: updateEvidenceInput.link,
        review: updateEvidenceInput.review,
      },
      include: {
        task: true,
        user: true, // uploader
      },
    });

    return this.mapEvidence(evidence);
  }

  async deleteEvidence(id: string, userId: string): Promise<boolean> {
    // Validar que la evidencia existe
    const existingEvidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });
    if (!existingEvidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingEvidence.task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para eliminar esta evidencia');
    }

    await this.prisma.evidence.delete({
      where: { id },
    });

    return true;
  }

  // ==================== COMMENT METHODS ====================

  async findAllComments(userId?: string): Promise<Comment[]> {
    const comments = await this.prisma.comment.findMany({
      include: {
        task: true,
        user: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return comments.map(comment => this.mapComment(comment));
  }

  async findCommentById(id: string): Promise<Comment | null> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        task: true,
        user: true,
      },
    });

    if (!comment) return null;
    return this.mapComment(comment);
  }

  async findCommentsByTask(taskId: string): Promise<Comment[]> {
    const comments = await this.prisma.comment.findMany({
      where: { id_task: taskId },
      include: {
        task: true,
        user: true,
      },
      orderBy: { created_at: 'asc' },
    });

    return comments.map(comment => this.mapComment(comment));
  }

  async createComment(createCommentInput: CreateCommentInput, userId: string): Promise<Comment> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: createCommentInput.taskId },
      include: { process: { include: { project: true } } },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Validar permisos: puede ser project_member o task_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: task.process.idproject,
        iduser: userId,
      },
    });

    const isTaskMember = await this.userService.isTaskMember(userId, createCommentInput.taskId);

    if (!projectMember && !isTaskMember) {
      throw new ForbiddenException('No tienes permisos para comentar en esta tarea');
    }

    const comment = await this.prisma.comment.create({
      data: {
        text: createCommentInput.text,
        id_user: userId,
        id_task: createCommentInput.taskId,
        created_at: new Date(),
      },
      include: {
        task: true,
        user: true,
      },
    });

    // Crear log de actividad
    await this.createLog({
      type: LogType.COMMENT_ADDED,
      taskId: createCommentInput.taskId,
      processId: task.idprocess,
      projectId: task.process.idproject || undefined,
    }, userId);

    return this.mapComment(comment);
  }

  async updateComment(updateCommentInput: UpdateCommentInput, userId: string): Promise<Comment> {
    // Validar que el comentario existe
    const existingComment = await this.prisma.comment.findUnique({
      where: { id: updateCommentInput.id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });
    if (!existingComment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingComment.task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para editar este comentario');
    }

    const comment = await this.prisma.comment.update({
      where: { id: updateCommentInput.id },
      data: {
        text: updateCommentInput.text,
      },
      include: {
        task: true,
        user: true,
      },
    });

    return this.mapComment(comment);
  }

  async deleteComment(id: string, userId: string): Promise<boolean> {
    // Validar que el comentario existe
    const existingComment = await this.prisma.comment.findUnique({
      where: { id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });
    if (!existingComment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingComment.task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para eliminar este comentario');
    }

    await this.prisma.comment.delete({
      where: { id },
    });

    return true;
  }

  // ==================== LOGS METHODS ====================

  async findAllLogs(userId?: string): Promise<Logs[]> {
    const logs = await this.prisma.logs.findMany({
      include: {
        user: true, // creator
        project: true,
        process: true,
        task: true,
      },
      orderBy: { createdat: 'desc' },
    });

    return logs.map(log => this.mapLog(log));
  }

  async findLogsByProject(projectId: string): Promise<Logs[]> {
    const logs = await this.prisma.logs.findMany({
      where: { idproject: projectId },
      include: {
        user: true, // creator
        project: true,
        process: true,
        task: true,
      },
      orderBy: { createdat: 'desc' },
    });

    return logs.map(log => this.mapLog(log));
  }

  async findLogsByProcess(processId: string): Promise<Logs[]> {
    const logs = await this.prisma.logs.findMany({
      where: { idprocess: processId },
      include: {
        user: true, // creator
        project: true,
        process: true,
        task: true,
      },
      orderBy: { createdat: 'desc' },
    });

    return logs.map(log => this.mapLog(log));
  }

  async findLogsByTask(taskId: string): Promise<Logs[]> {
    const logs = await this.prisma.logs.findMany({
      where: { idtask: taskId },
      include: {
        user: true, // creator
        project: true,
        process: true,
        task: true,
      },
      orderBy: { createdat: 'desc' },
    });

    return logs.map(log => this.mapLog(log));
  }

  async createLog(createLogInput: CreateLogInput, creatorId: string): Promise<Logs> {
    const log = await this.prisma.logs.create({
      data: {
        type: createLogInput.type,
        idcreator: creatorId,
        idproject: createLogInput.projectId,
        idprocess: createLogInput.processId,
        idtask: createLogInput.taskId,
        createdat: new Date(),
      },
      include: {
        user: true, // creator
        project: true,
        process: true,
        task: true,
      },
    });

    return this.mapLog(log);
  }

  // ==================== HELPER METHODS ====================

  private mapEvidence(evidence: any): Evidence {
    return {
      id: evidence.id,
      taskId: evidence.idtask,
      task: evidence.task,
      link: evidence.link,
      uploaderId: evidence.iduploader,
      uploader: evidence.user,
      uploadedAt: evidence.uploadedat,
      review: evidence.review,
      createdAt: evidence.createdat,
      updatedAt: evidence.updatedat,
    };
  }

  private mapComment(comment: any): Comment {
    return {
      id: comment.id,
      text: comment.text,
      createdAt: comment.created_at,
      userId: comment.id_user,
      user: comment.user,
      taskId: comment.id_task,
      task: comment.task,
      updatedAt: comment.updated_at,
    };
  }

  private mapLog(log: any): Logs {
    return {
      id: log.id,
      type: log.type,
      createdAt: log.createdat,
      creatorId: log.idcreator,
      creator: log.user,
      projectId: log.idproject,
      project: log.project,
      processId: log.idprocess,
      process: log.process,
      taskId: log.idtask,
      task: log.task,
      updatedAt: log.updatedat,
    };
  }
}
