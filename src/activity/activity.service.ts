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
  private readonly EXCLUDE_ARCHIVED = { archived_at: null };

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  // ==================== EVIDENCE METHODS ====================

  async findAllEvidence(userId?: string, includeArchived = false): Promise<Evidence[]> {
    const evidence = await this.prisma.evidence.findMany({
      where: includeArchived ? {} : this.EXCLUDE_ARCHIVED,
      include: {
        task: true,
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
      },
      orderBy: { uploadedat: 'desc' },
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }

  async findEvidenceById(id: string, includeArchived = false): Promise<Evidence | null> {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        task: true,
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
      },
    });

    if (!evidence) return null;
    
    // Si no incluimos archivadas y está archivada, retornar null
    if (!includeArchived && evidence.archived_at) return null;
    
    return this.mapEvidence(evidence);
  }

  async findEvidenceByTask(taskId: string, includeArchived = false): Promise<Evidence[]> {
    const evidence = await this.prisma.evidence.findMany({
      where: {
        idtask: taskId,
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      },
      include: {
        task: true,
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
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

    // Validar permisos usando la lógica jerárquica
    if (!existingEvidence.task.process.idproject) {
      throw new ForbiddenException('El proyecto no está disponible');
    }
    const canAccess = await this.userService.canAccessProject(userId, existingEvidence.task.process.idproject);
    if (!canAccess) {
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

    // Validar permisos usando la lógica jerárquica
    if (!existingEvidence.task.process.idproject) {
      throw new ForbiddenException('El proyecto no está disponible');
    }
    const canAccess = await this.userService.canAccessProject(userId, existingEvidence.task.process.idproject);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para eliminar esta evidencia');
    }

    await this.prisma.evidence.delete({
      where: { id },
    });

    return true;
  }

  async archiveEvidence(id: string, userId: string): Promise<Evidence> {
    // Validar que la evidencia existe y no está archivada
    const existingEvidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });

    if (!existingEvidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    if (existingEvidence.archived_at) {
      throw new BadRequestException('La evidencia ya está archivada');
    }

    // Validar permisos usando la lógica jerárquica
    if (!existingEvidence.task.process.idproject) {
      throw new ForbiddenException('El proyecto no está disponible');
    }
    const canAccess = await this.userService.canAccessProject(userId, existingEvidence.task.process.idproject);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para archivar esta evidencia');
    }

    // Archivar
    const evidence = await this.prisma.evidence.update({
      where: { id },
      data: {
        archived_at: new Date(),
        archived_by: userId,
      },
      include: {
        task: true,
        user: true,
        user_evidence_archived_byTouser: true,
      },
    });

    return this.mapEvidence(evidence);
  }

  async unarchiveEvidence(id: string, userId: string): Promise<Evidence> {
    // Validar que la evidencia existe y está archivada
    const existingEvidence = await this.prisma.evidence.findUnique({
      where: { id },
      include: { task: { include: { process: { include: { project: true } } } } },
    });

    if (!existingEvidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    if (!existingEvidence.archived_at) {
      throw new BadRequestException('La evidencia no está archivada');
    }

    // Validar permisos usando la lógica jerárquica
    if (!existingEvidence.task.process.idproject) {
      throw new ForbiddenException('El proyecto no está disponible');
    }
    const canAccess = await this.userService.canAccessProject(userId, existingEvidence.task.process.idproject);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para desarchivar esta evidencia');
    }

    // Desarchivar
    const evidence = await this.prisma.evidence.update({
      where: { id },
      data: {
        archived_at: null,
        archived_by: null,
      },
      include: {
        task: true,
        user: true,
        user_evidence_archived_byTouser: true,
      },
    });

    return this.mapEvidence(evidence);
  }

  async replaceEvidence(evidenceId: string, newLink: string, userId: string, review?: string): Promise<Evidence> {
    // Validar que la evidencia existe
    const existingEvidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { task: { include: { process: { include: { project: true } } } } },
    });

    if (!existingEvidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }

    // Validar permisos usando la lógica jerárquica
    if (!existingEvidence.task.process.idproject) {
      throw new ForbiddenException('El proyecto no está disponible');
    }
    const canAccess = await this.userService.canAccessProject(userId, existingEvidence.task.process.idproject);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para reemplazar esta evidencia');
    }

    // Eliminar archivo físico anterior
    const fs = require('fs').promises;
    const path = require('path');
    const oldFilePath = path.join(process.cwd(), existingEvidence.link);
    
    try {
      await fs.unlink(oldFilePath);
    } catch (error) {
      // Si el archivo no existe o hay error, continuar igual (log warning)
      console.warn(`No se pudo eliminar archivo anterior: ${oldFilePath}`, error.message);
    }

    // Actualizar en BD
    const updatedEvidence = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        link: newLink,
        version: (existingEvidence.version || 1) + 1,
        reuploaded_at: new Date(),
        review: review !== undefined ? review : existingEvidence.review,
      },
      include: {
        task: true,
        user: true,
        user_evidence_archived_byTouser: true,
      },
    });

    // Crear log de actividad
    await this.createLog({
      type: LogType.EVIDENCE_REPLACED,
      taskId: existingEvidence.idtask,
      processId: existingEvidence.task.idprocess,
      projectId: existingEvidence.task.process.idproject || undefined,
    }, userId);

    return this.mapEvidence(updatedEvidence);
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

    // Crear log de actividad
    await this.createLog({
      type: LogType.COMMENT_DELETED,
      taskId: existingComment.id_task,
      processId: existingComment.task.idprocess,
      projectId: existingComment.task.process.idproject || undefined,
    }, userId);

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
      version: evidence.version,
      reuploadedAt: evidence.reuploaded_at,
      archivedAt: evidence.archived_at,
      archivedBy: evidence.archived_by,
      archivedByUser: evidence.user_evidence_archived_byTouser,
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

  // ==================== EVIDENCE BY PROJECT ====================

  async findEvidenceByProject(projectId: string, includeArchived = false): Promise<Evidence[]> {
    // Obtener todas las evidencias que pertenecen a tareas del proyecto
    const evidence = await this.prisma.evidence.findMany({
      where: {
        task: {
          process: {
            idproject: projectId
          }
        },
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      },
      include: {
        task: {
          include: {
            process: {
              include: {
                project: {
                  include: {
                    category: {
                      include: {
                        area: true
                      }
                    },
                    unit: true
                  }
                }
              }
            }
          }
        },
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
      },
      orderBy: {
        uploadedat: 'desc'
      }
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }

  // ==================== EVIDENCE BY USER ====================

  async findEvidenceByUser(userId: string, includeArchived = false): Promise<Evidence[]> {
    // Obtener todas las evidencias asociadas a un usuario específico
    // Considerando la jerarquía de roles del sistema:
    // - super_admin: ve todas las evidencias
    // - area_role: ve evidencias de su área + proyectos donde es miembro
    // - unit_role: ve evidencias de su unidad + proyectos donde es miembro  
    // - user: ve evidencias de proyectos/tareas donde es miembro + las que subió
    
    // Primero obtener el system_role del usuario para optimizar la query
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const userRole = userSystemRole?.role?.name;

    let whereClause: any = {
      ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
    };

    // Construir condiciones según el rol del usuario
    if (userRole === 'super_admin') {
      // Super admin ve todas las evidencias
      whereClause = {
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      };
    } else if (userRole === 'area_role') {
      // Area role ve evidencias de su área + proyectos donde es miembro
      const userAreas = await this.prisma.area_member.findMany({
        where: { iduser: userId },
        select: { idarea: true }
      });
      
      const userAdminAreas = await this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true }
      });

      const allAreaIds = [
        ...userAreas.map(a => a.idarea),
        ...userAdminAreas.map(a => a.idarea)
      ];

      whereClause = {
        ...whereClause,
        OR: [
          // Evidencias subidas por el usuario
          { iduploader: userId },
          // Evidencias de proyectos donde es project_member
          {
            task: {
              process: {
                project: {
                  project_member: {
                    some: { iduser: userId }
                  }
                }
              }
            }
          },
          // Evidencias de tareas donde es task_member
          {
            task: {
              task_member: {
                some: { iduser: userId }
              }
            }
          },
          // Evidencias de proyectos de sus áreas
          {
            task: {
              process: {
                project: {
                  category: {
                    id_area: { in: allAreaIds }
                  }
                }
              }
            }
          }
        ]
      };
    } else if (userRole === 'unit_role') {
      // Unit role ve evidencias de su unidad + proyectos donde es miembro
      const userUnits = await this.prisma.unit_member.findMany({
        where: { iduser: userId },
        select: { idunit: true }
      });

      const unitIds = userUnits.map(u => u.idunit);

      whereClause = {
        ...whereClause,
        OR: [
          // Evidencias subidas por el usuario
          { iduploader: userId },
          // Evidencias de proyectos donde es project_member
          {
            task: {
              process: {
                project: {
                  project_member: {
                    some: { iduser: userId }
                  }
                }
              }
            }
          },
          // Evidencias de tareas donde es task_member
          {
            task: {
              task_member: {
                some: { iduser: userId }
              }
            }
          },
          // Evidencias de proyectos de sus unidades
          {
            task: {
              process: {
                project: {
                  idunit: { in: unitIds }
                }
              }
            }
          }
        ]
      };
    } else {
      // User normal: solo evidencias de proyectos/tareas donde es miembro + las que subió
      whereClause = {
        ...whereClause,
        OR: [
          // Evidencias subidas por el usuario
          { iduploader: userId },
          // Evidencias de proyectos donde es project_member
          {
            task: {
              process: {
                project: {
                  project_member: {
                    some: { iduser: userId }
                  }
                }
              }
            }
          },
          // Evidencias de tareas donde es task_member
          {
            task: {
              task_member: {
                some: { iduser: userId }
              }
            }
          }
        ]
      };
    }

    const evidence = await this.prisma.evidence.findMany({
      where: whereClause,
      include: {
        task: {
          include: {
            process: {
              include: {
                project: {
                  include: {
                    category: {
                      include: {
                        area: true
                      }
                    },
                    unit: true
                  }
                }
              }
            }
          }
        },
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
      },
      orderBy: {
        uploadedat: 'desc'
      }
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }

  // ==================== EVIDENCE BY PROCESS ====================

  async findEvidenceByProcess(processId: string, includeArchived = false): Promise<Evidence[]> {
    // Obtener todas las evidencias que pertenecen a tareas del proceso
    const evidence = await this.prisma.evidence.findMany({
      where: {
        task: {
          idprocess: processId
        },
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      },
      include: {
        task: {
          include: {
            process: {
              include: {
                project: {
                  include: {
                    category: {
                      include: {
                        area: true
                      }
                    },
                    unit: true
                  }
                }
              }
            }
          }
        },
        user: true, // uploader
        user_evidence_archived_byTouser: true, // archived by user
      },
      orderBy: {
        uploadedat: 'desc'
      }
    });

    return evidence.map(ev => this.mapEvidence(ev));
  }
}
