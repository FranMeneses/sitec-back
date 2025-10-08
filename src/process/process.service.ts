import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { Process } from './entities/process.entity';
import { Task } from './entities/task.entity';
import { CreateProcessInput, UpdateProcessInput } from './dto/process.dto';
import { CreateTaskInput, UpdateTaskInput, TaskStatus } from './dto/task.dto';
import { TaskMember } from './entities/task-member.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class ProcessService {
  private readonly EXCLUDE_ARCHIVED = { archived_at: null };

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) { }

  // ==================== HELPER METHODS ====================

  private async canAccessProject(projectId: string, userId: string): Promise<boolean> {
    // Super admin puede hacer cualquier cosa
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin del sistema puede hacer operaciones en su área
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) {
      // Verificar que el proyecto pertenece a su área
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          category: {
            include: {
              area: true
            }
          }
        }
      });

      if (!project || !project.category) {
        return false;
      }

      const adminArea = await this.prisma.admin.findFirst({
        where: { iduser: userId },
        select: { idarea: true }
      });

      if (!adminArea) {
        return false;
      }

      return project.category.id_area === adminArea.idarea;
    }

    // Verificar si es area_member del área del proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        category: {
          include: {
            area: true
          }
        }
      }
    });

    if (!project || !project.category) {
      return false;
    }

    const isAreaMember = await this.prisma.area_member.findFirst({
      where: {
        iduser: userId,
        idarea: project.category.id_area
      }
    });

    if (isAreaMember) {
      return true;
    }

    // Verificar si es project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });

    if (projectMember) {
      return true;
    }

    // Verificar si es task_member de alguna tarea del proyecto
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        iduser: userId,
        task: {
          process: {
            idproject: projectId
          }
        }
      }
    });

    return !!taskMember;
  }

  private async canCreateTask(projectId: string, userId: string): Promise<boolean> {
    // Super admin puede crear tareas en cualquier proyecto
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin del sistema puede crear tareas en proyectos de su área
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) {
      // Verificar que el proyecto pertenece a su área
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          category: {
            include: {
              area: true
            }
          }
        }
      });

      if (!project || !project.category) {
        return false;
      }

      const adminArea = await this.prisma.admin.findFirst({
        where: { iduser: userId },
        select: { idarea: true }
      });

      if (!adminArea) {
        return false;
      }

      return project.category.id_area === adminArea.idarea;
    }

    // Verificar si es area_member del área del proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        category: {
          include: {
            area: true
          }
        }
      }
    });

    if (!project || !project.category) {
      return false;
    }

    const isAreaMember = await this.prisma.area_member.findFirst({
      where: {
        iduser: userId,
        idarea: project.category.id_area
      }
    });

    if (isAreaMember) {
      return true;
    }

    // Verificar si es project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });

    if (projectMember) {
      return true;
    }

    // Verificar si es task_member de alguna tarea del proyecto
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        iduser: userId,
        task: {
          process: {
            idproject: projectId
          }
        }
      }
    });

    return !!taskMember;
  }

  private validateProcessDates(startDate?: string, dueDate?: string): void {
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);

      if (due < start) {
        throw new BadRequestException('La fecha de vencimiento del proceso no puede ser anterior a la fecha de inicio');
      }
    }
  }

  private async validateProcessDatesAgainstProject(
    projectId: string,
    startDate?: string,
    dueDate?: string
  ): Promise<void> {
    // Obtener las fechas del proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startdate: true, duedate: true }
    });

    if (!project) {
      throw new BadRequestException('El proyecto especificado no existe');
    }

    // Validar fechas del proceso entre sí
    this.validateProcessDates(startDate, dueDate);

    // Si el proyecto tiene fechas definidas, validar que el proceso esté dentro del rango
    if (project.startdate && startDate) {
      const projectStart = new Date(project.startdate);
      const processStart = new Date(startDate);

      if (processStart < projectStart) {
        throw new BadRequestException('La fecha de inicio del proceso no puede ser anterior a la fecha de inicio del proyecto');
      }
    }

    if (project.duedate && dueDate) {
      const projectDue = new Date(project.duedate);
      const processDue = new Date(dueDate);

      if (processDue > projectDue) {
        throw new BadRequestException('La fecha de vencimiento del proceso no puede ser posterior a la fecha de vencimiento del proyecto');
      }
    }

    // Validar que si el proceso tiene fechas, estén dentro del rango del proyecto
    if (project.startdate && project.duedate) {
      const projectStart = new Date(project.startdate);
      const projectDue = new Date(project.duedate);

      if (startDate) {
        const processStart = new Date(startDate);
        if (processStart < projectStart || processStart > projectDue) {
          throw new BadRequestException('La fecha de inicio del proceso debe estar dentro del rango de fechas del proyecto');
        }
      }

      if (dueDate) {
        const processDue = new Date(dueDate);
        if (processDue < projectStart || processDue > projectDue) {
          throw new BadRequestException('La fecha de vencimiento del proceso debe estar dentro del rango de fechas del proyecto');
        }
      }
    }
  }

  private async validateProcessDatesForUpdate(
    existingProcess: any,
    startDate?: string,
    dueDate?: string
  ): Promise<void> {
    // Usar las fechas del input o las existentes
    const finalStartDate = startDate || existingProcess.startdate?.toISOString();
    const finalDueDate = dueDate || existingProcess.duedate?.toISOString();

    // Validar contra el proyecto
    if (existingProcess.idproject) {
      await this.validateProcessDatesAgainstProject(
        existingProcess.idproject,
        finalStartDate,
        finalDueDate
      );
    }
  }

  private validateTaskDates(startDate?: string, dueDate?: string): void {
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);

      if (due < start) {
        throw new BadRequestException('La fecha de vencimiento de la tarea no puede ser anterior a la fecha de inicio');
      }
    }
  }

  private async validateTaskDatesAgainstProcess(
    processId: string,
    startDate?: string,
    dueDate?: string
  ): Promise<void> {
    // Obtener las fechas del proceso
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { startdate: true, duedate: true }
    });

    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Validar fechas de la tarea entre sí
    this.validateTaskDates(startDate, dueDate);

    // Si el proceso tiene fechas definidas, validar que la tarea esté dentro del rango
    if (process.startdate && startDate) {
      const processStart = new Date(process.startdate);
      const taskStart = new Date(startDate);

      if (taskStart < processStart) {
        throw new BadRequestException('La fecha de inicio de la tarea no puede ser anterior a la fecha de inicio del proceso');
      }
    }

    if (process.duedate && dueDate) {
      const processDue = new Date(process.duedate);
      const taskDue = new Date(dueDate);

      if (taskDue > processDue) {
        throw new BadRequestException('La fecha de vencimiento de la tarea no puede ser posterior a la fecha de vencimiento del proceso');
      }
    }

    // Validar que si la tarea tiene fechas, estén dentro del rango del proceso
    if (process.startdate && process.duedate) {
      const processStart = new Date(process.startdate);
      const processDue = new Date(process.duedate);

      if (startDate) {
        const taskStart = new Date(startDate);
        if (taskStart < processStart || taskStart > processDue) {
          throw new BadRequestException('La fecha de inicio de la tarea debe estar dentro del rango de fechas del proceso');
        }
      }

      if (dueDate) {
        const taskDue = new Date(dueDate);
        if (taskDue < processStart || taskDue > processDue) {
          throw new BadRequestException('La fecha de vencimiento de la tarea debe estar dentro del rango de fechas del proceso');
        }
      }
    }
  }

  private async validateTaskDatesForUpdate(
    existingTask: any,
    startDate?: string,
    dueDate?: string
  ): Promise<void> {
    // Usar las fechas del input o las existentes
    const finalStartDate = startDate || existingTask.startdate?.toISOString();
    const finalDueDate = dueDate || existingTask.duedateat?.toISOString();

    // Validar contra el proceso
    if (existingTask.idprocess) {
      await this.validateTaskDatesAgainstProcess(
        existingTask.idprocess,
        finalStartDate,
        finalDueDate
      );
    }
  }

  // ==================== PROCESS METHODS ====================

  async findAllProcesses(userId?: string, includeArchived = false): Promise<Process[]> {
    const processes = await this.prisma.process.findMany({
      where: includeArchived ? {} : this.EXCLUDE_ARCHIVED,
      include: {
        user: true, // editor
        project: true,
        user_process_archived_byTouser: true, // archived by user
      },
      orderBy: { name: 'asc' },
    });

    return processes.map(process => this.mapProcess(process));
  }

  async findProcessById(id: string, includeArchived = false): Promise<Process | null> {
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: {
        user: true, // editor
        project: true,
        user_process_archived_byTouser: true, // archived by user
      },
    });

    if (!process) return null;

    // Si no incluimos archivados y está archivado, retornar null
    if (!includeArchived && process.archived_at) return null;

    return this.mapProcess(process);
  }

  async findProcessesByProject(projectId: string, includeArchived = false): Promise<Process[]> {
    const processes = await this.prisma.process.findMany({
      where: {
        idproject: projectId,
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      },
      include: {
        user: true, // editor
        project: true,
        user_process_archived_byTouser: true, // archived by user
      },
      orderBy: { name: 'asc' },
    });

    return processes.map(process => this.mapProcess(process));
  }

  async createProcess(createProcessInput: CreateProcessInput, editorId: string): Promise<Process> {
    // Validar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: createProcessInput.projectId },
    });
    if (!project) {
      throw new BadRequestException('El proyecto especificado no existe');
    }

    // Validar fechas del proceso contra el proyecto
    await this.validateProcessDatesAgainstProject(
      createProcessInput.projectId,
      createProcessInput.startDate,
      createProcessInput.dueDate
    );

    // Validar que el usuario puede acceder al proyecto
    const canAccess = await this.canAccessProject(createProcessInput.projectId, editorId);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para crear procesos en este proyecto');
    }

    const process = await this.prisma.process.create({
      data: {
        name: createProcessInput.name,
        description: createProcessInput.description,
        startdate: createProcessInput.startDate ? new Date(createProcessInput.startDate) : null,
        duedate: createProcessInput.dueDate ? new Date(createProcessInput.dueDate) : null,
        review: createProcessInput.review,
        ideditor: editorId,
        idproject: createProcessInput.projectId,
        editedat: new Date(),
      },
      include: {
        user: true,
        project: true,
      },
    });

    return this.mapProcess(process);
  }

  async updateProcess(updateProcessInput: UpdateProcessInput, editorId: string): Promise<Process> {
    // Validar que el proceso existe
    const existingProcess = await this.prisma.process.findUnique({
      where: { id: updateProcessInput.id },
      include: { project: true },
    });
    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    // Validar fechas del proceso (considerando fechas existentes)
    await this.validateProcessDatesForUpdate(
      existingProcess,
      updateProcessInput.startDate,
      updateProcessInput.dueDate
    );

    // Validar que el usuario puede acceder al proyecto
    if (!existingProcess.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }
    const canAccess = await this.canAccessProject(existingProcess.idproject, editorId);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para editar este proceso');
    }

    const process = await this.prisma.process.update({
      where: { id: updateProcessInput.id },
      data: {
        name: updateProcessInput.name,
        description: updateProcessInput.description,
        startdate: updateProcessInput.startDate ? new Date(updateProcessInput.startDate) : null,
        duedate: updateProcessInput.dueDate ? new Date(updateProcessInput.dueDate) : null,
        review: updateProcessInput.review,
        ideditor: editorId,
        editedat: new Date(),
      },
      include: {
        user: true,
        project: true,
      },
    });

    return this.mapProcess(process);
  }

  async deleteProcess(id: string, userId: string): Promise<boolean> {
    // Validar que el proceso existe
    const existingProcess = await this.prisma.process.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    // Validar que el usuario puede acceder al proyecto
    if (!existingProcess.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }
    const canAccess = await this.canAccessProject(existingProcess.idproject, userId);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para eliminar este proceso');
    }

    // Verificar que no hay tareas asociadas
    const taskCount = await this.prisma.task.count({
      where: { idprocess: id },
    });
    if (taskCount > 0) {
      throw new BadRequestException('No se puede eliminar un proceso que tiene tareas asociadas');
    }

    await this.prisma.process.delete({
      where: { id },
    });

    return true;
  }

  /**
   * Archiva solo el proceso (sin tocar las tareas)
   * Uso: Cuando todas las tareas ya están archivadas (automático)
   */
  async archiveProcessOnly(processId: string, userId: string | null): Promise<Process> {
    const existingProcess = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true, user: true, user_process_archived_byTouser: true },
    });

    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    if (existingProcess.archived_at) {
      throw new BadRequestException('El proceso ya está archivado');
    }

    // Archivar el proceso
    const archivedProcess = await this.prisma.process.update({
      where: { id: processId },
      data: {
        archived_at: new Date(),
        archived_by: userId, // NULL si es automático, userId si es manual
      },
      include: {
        user: true,
        project: true,
        user_process_archived_byTouser: true,
      },
    });

    // Verificar si todos los procesos del proyecto están archivados
    if (existingProcess.idproject) {
      await this.checkAndArchiveProject(existingProcess.idproject);
    }

    return this.mapProcess(archivedProcess);
  }

  /**
   * Verifica si todos los procesos de un proyecto están archivados
   * Si es así, archiva el proyecto automáticamente
   */
  private async checkAndArchiveProject(projectId: string): Promise<void> {
    // Contar total de procesos del proyecto
    const totalProcesses = await this.prisma.process.count({
      where: { idproject: projectId },
    });

    // Contar procesos archivados del proyecto
    const archivedProcesses = await this.prisma.process.count({
      where: {
        idproject: projectId,
        archived_at: { not: null },
      },
    });

    // Si todos están archivados y hay al menos un proceso, archivar el proyecto
    if (totalProcesses > 0 && totalProcesses === archivedProcesses) {
      // Verificar que el proyecto no esté ya archivado
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (project && !project.archived_at) {
        // Archivar el proyecto directamente (no necesitamos llamar a ProjectService)
        await this.prisma.project.update({
          where: { id: projectId },
          data: {
            archived_at: new Date(),
            archived_by: null, // null porque es archivado automático
          },
        });

        // Crear log de archivado automático
        await this.prisma.logs.create({
          data: {
            type: 'project_archived',
            idcreator: project.ideditor || '00000000-0000-0000-0000-000000000000', // Sistema
            idproject: projectId,
          },
        });
      }
    }
  }

  /**
   * Archiva el proceso y TODAS sus tareas (con evidencias en cascada)
   * Uso: Cuando se archiva un proyecto (desde Project service)
   */
  async archiveProcessWithTasks(processId: string, userId: string): Promise<Process> {
    const existingProcess = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });

    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    if (existingProcess.archived_at) {
      throw new BadRequestException('El proceso ya está archivado');
    }

    // 1. Obtener todas las tareas NO archivadas del proceso
    const activeTasks = await this.prisma.task.findMany({
      where: {
        idprocess: processId,
        archived_at: null,
      },
    });

    // 2. Archivar cada tarea con sus evidencias
    for (const task of activeTasks) {
      await this.archiveTaskWithEvidences(task.id, null); // userId=null porque es cascada
    }

    // 3. Archivar el proceso
    const archivedProcess = await this.prisma.process.update({
      where: { id: processId },
      data: {
        archived_at: new Date(),
        archived_by: userId,
      },
      include: {
        user: true,
        project: true,
        user_process_archived_byTouser: true,
      },
    });

    return this.mapProcess(archivedProcess);
  }

  async unarchiveProcess(processId: string, userId: string): Promise<Process> {
    const existingProcess = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });

    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    if (!existingProcess.archived_at) {
      throw new BadRequestException('El proceso no está archivado');
    }

    // Validar permisos
    if (!existingProcess.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canAccess = await this.canAccessProject(existingProcess.idproject, userId);
    if (!canAccess) {
      throw new ForbiddenException('No tienes permisos para desarchivar este proceso');
    }

    // Desarchivar el proceso (las tareas permanecen archivadas)
    const unarchivedProcess = await this.prisma.process.update({
      where: { id: processId },
      data: {
        archived_at: null,
        archived_by: null,
      },
      include: {
        user: true,
        project: true,
        user_process_archived_byTouser: true,
      },
    });

    return this.mapProcess(unarchivedProcess);
  }

  // ==================== TASK METHODS ====================

  async findAllTasks(userId?: string, includeArchived = false): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      where: includeArchived ? {} : this.EXCLUDE_ARCHIVED,
      include: {
        user: true, // editor
        process: true,
        user_task_archived_byTouser: true, // archived by user
      },
      orderBy: { name: 'asc' },
    });

    return tasks.map(task => this.mapTask(task));
  }

  async findTaskById(id: string, includeArchived = false): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        user: true, // editor
        process: true,
        user_task_archived_byTouser: true, // archived by user
      },
    });

    if (!task) return null;

    // Si no incluimos archivadas y está archivada, retornar null
    if (!includeArchived && task.archived_at) return null;

    return this.mapTask(task);
  }

  async findTasksByProcess(processId: string, includeArchived = false): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        idprocess: processId,
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
      },
      include: {
        user: true, // editor
        process: true,
        user_task_archived_byTouser: true, // archived by user
      },
      orderBy: { name: 'asc' },
    });

    return tasks.map(task => this.mapTask(task));
  }

  async findTasksByTaskId(taskId: string, includeArchived = false): Promise<Task[]> {
    // Esta query retorna la tarea específica con su proceso asociado
    // Es útil para obtener información completa de una tarea y su proceso
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
        ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED)
      },
      include: {
        user: true, // editor
        process: true,
        user_task_archived_byTouser: true, // archived by user
      },
    });

    if (!task) {
      return [];
    }

    return [this.mapTask(task)];
  }

  async createProcessTask(idProcess: string, idTask: string, userId: string): Promise<string> {
    // Verificar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id: idProcess },
      include: { project: true },
    });
    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Verificar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: idTask },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Verificar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para crear esta asociación');
    }

    // Actualizar la tarea para asociarla al proceso
    await this.prisma.task.update({
      where: { id: idTask },
      data: {
        idprocess: idProcess,
        ideditor: userId,
        editedat: new Date(),
      },
    });

    return `Tarea ${idTask} asociada exitosamente al proceso ${idProcess}`;
  }

  async removeProcessTask(id: string, userId: string): Promise<string> {
    // Verificar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { process: { include: { project: true } } },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Verificar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para eliminar esta asociación');
    }

    // Eliminar la tarea (esto también elimina la asociación con el proceso)
    await this.prisma.task.delete({
      where: { id },
    });

    return `Tarea ${id} eliminada exitosamente`;
  }

  async createTask(createTaskInput: CreateTaskInput, editorId: string): Promise<Task> {
    // Validar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id: createTaskInput.processId },
      include: { project: true },
    });
    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Validar fechas de la tarea contra el proceso
    await this.validateTaskDatesAgainstProcess(
      createTaskInput.processId,
      createTaskInput.startDate,
      createTaskInput.dueDate
    );

    // Validar permisos para crear tareas
    if (!process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canCreateTask = await this.canCreateTask(process.idproject, editorId);
    if (!canCreateTask) {
      throw new ForbiddenException('No tienes permisos para crear tareas en este proceso');
    }

    // Validar asignaciones de miembros si se proporcionan
    if (createTaskInput.memberAssignments && createTaskInput.memberAssignments.length > 0) {
      for (const assignment of createTaskInput.memberAssignments) {
        // Verificar que el usuario pertenece al proyecto
        const memberToAssign = await this.prisma.project_member.findFirst({
          where: {
            idproject: process.idproject,
            iduser: assignment.userId,
          },
        });
        if (!memberToAssign) {
          throw new BadRequestException(`El usuario ${assignment.userId} no pertenece al proyecto`);
        }
      }
    }
    // Crear la tarea
    const task = await this.prisma.task.create({
      data: {
        name: createTaskInput.name,
        description: createTaskInput.description,
        startdate: createTaskInput.startDate ? new Date(createTaskInput.startDate) : null,
        duedateat: createTaskInput.dueDate ? new Date(createTaskInput.dueDate) : null,
        status: createTaskInput.status,
        ideditor: editorId,
        idprocess: createTaskInput.processId,
        budget: createTaskInput.budget,
        expense: createTaskInput.expense,
        review: createTaskInput.review,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    // Auto-asignar al creador (project_member) como task_member
    const taskMemberRole = await this.prisma.role.findFirst({
      where: { name: 'task_member' }
    });

    if (taskMemberRole) {
      await this.prisma.task_member.create({
        data: {
          idtask: task.id,
          iduser: editorId, // El project_member que creó la tarea
          idrole: taskMemberRole.id,
          assigned_at: new Date(),
        },
      });
    }

    if (createTaskInput.memberAssignments && createTaskInput.memberAssignments.length > 0) {
      // Asignar los miembros especificados (además del creador)
      for (const assignment of createTaskInput.memberAssignments) {
        // Verificar que no se esté intentando asignar al creador de nuevo
        if (assignment.userId === editorId) {
          continue; // Saltar, ya fue asignado automáticamente
        }

        await this.prisma.task_member.create({
          data: {
            idtask: task.id,
            iduser: assignment.userId,
            idrole: assignment.roleId,
            assigned_at: new Date(),
          },
        });
      }

    }

    // Recargar la tarea con los task_member incluidos
    const taskWithMembers = await this.prisma.task.findUnique({
      where: { id: task.id },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(taskWithMembers!);
  }

  async updateTask(updateTaskInput: UpdateTaskInput, editorId: string): Promise<Task> {
    // Validar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id: updateTaskInput.id },
      include: { process: { include: { project: true } } },
    });
    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Validar fechas de la tarea (considerando fechas existentes)
    await this.validateTaskDatesForUpdate(
      existingTask,
      updateTaskInput.startDate,
      updateTaskInput.dueDate
    );

    // Validar permisos para editar tareas
    if (!existingTask.process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canEditTask = await this.canCreateTask(existingTask.process.idproject, editorId);
    if (!canEditTask) {
      throw new ForbiddenException('No tienes permisos para editar esta tarea');
    }

    // Detectar si el estado cambió a COMPLETED o CANCELLED
    const statusChanged = updateTaskInput.status && updateTaskInput.status !== existingTask.status;
    const shouldArchive = statusChanged &&
      (updateTaskInput.status === TaskStatus.COMPLETED ||
        updateTaskInput.status === TaskStatus.CANCELLED);

    // Si debe archivarse, primero actualizar y luego archivar
    if (shouldArchive) {
      // Actualizar la tarea primero
      await this.prisma.task.update({
        where: { id: updateTaskInput.id },
        data: {
          name: updateTaskInput.name,
          description: updateTaskInput.description,
          startdate: updateTaskInput.startDate ? new Date(updateTaskInput.startDate) : null,
          duedateat: updateTaskInput.dueDate ? new Date(updateTaskInput.dueDate) : null,
          status: updateTaskInput.status,
          ideditor: editorId,
          report: updateTaskInput.report,
          budget: updateTaskInput.budget,
          expense: updateTaskInput.expense,
          review: updateTaskInput.review,
          editedat: new Date(),
        },
      });

      // Archivar en cascada (incluye evidencias)
      return await this.archiveTaskWithEvidences(updateTaskInput.id, editorId);
    }

    // Actualización normal (sin archivar)
    const task = await this.prisma.task.update({
      where: { id: updateTaskInput.id },
      data: {
        name: updateTaskInput.name,
        description: updateTaskInput.description,
        startdate: updateTaskInput.startDate ? new Date(updateTaskInput.startDate) : null,
        duedateat: updateTaskInput.dueDate ? new Date(updateTaskInput.dueDate) : null,
        status: updateTaskInput.status,
        ideditor: editorId,
        report: updateTaskInput.report,
        budget: updateTaskInput.budget,
        expense: updateTaskInput.expense,
        review: updateTaskInput.review,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(task);
  }

  async updateTaskAsMember(updateTaskInput: { id: string; status?: string; report?: string; budget?: number; expense?: number }, memberId: string): Promise<Task> {
    // Validar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id: updateTaskInput.id },
      include: { process: { include: { project: true } } },
    });
    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Validar que el usuario es task_member de esta tarea
    const isTaskMember = await this.userService.isTaskMember(memberId, updateTaskInput.id);
    if (!isTaskMember) {
      throw new ForbiddenException('No tienes permisos para editar esta tarea');
    }

    // Detectar si el estado cambió a COMPLETED o CANCELLED
    const statusChanged = updateTaskInput.status && updateTaskInput.status !== existingTask.status;
    const shouldArchive = statusChanged &&
      (updateTaskInput.status === 'completed' ||
        updateTaskInput.status === 'cancelled');

    // Si debe archivarse, primero actualizar y luego archivar
    if (shouldArchive) {
      // Preparar datos de actualización
      const updateData: any = {
        editedat: new Date(),
        ideditor: memberId,
      };

      if (updateTaskInput.status !== undefined) {
        updateData.status = updateTaskInput.status;
      }

      if (updateTaskInput.report !== undefined) {
        updateData.report = updateTaskInput.report;
      }

      if (updateTaskInput.budget !== undefined) {
        updateData.budget = updateTaskInput.budget;
      }

      if (updateTaskInput.expense !== undefined) {
        updateData.expense = updateTaskInput.expense;
      }

      // Actualizar la tarea primero
      await this.prisma.task.update({
        where: { id: updateTaskInput.id },
        data: updateData,
      });

      // Archivar en cascada (incluye evidencias)
      return await this.archiveTaskWithEvidences(updateTaskInput.id, memberId);
    }

    // Actualización normal (sin archivar)
    const updateData: any = {
      editedat: new Date(),
    };

    if (updateTaskInput.status !== undefined) {
      updateData.status = updateTaskInput.status;
    }

    if (updateTaskInput.report !== undefined) {
      updateData.report = updateTaskInput.report;
    }

    if (updateTaskInput.budget !== undefined) {
      updateData.budget = updateTaskInput.budget;
    }

    if (updateTaskInput.expense !== undefined) {
      updateData.expense = updateTaskInput.expense;
    }

    const task = await this.prisma.task.update({
      where: { id: updateTaskInput.id },
      data: updateData,
      include: {
        user: true,
        process: true,
      },
    });

    return this.mapTask(task);
  }

  // ==================== TASK_MEMBER METHODS ====================

  async assignTaskMember(taskId: string, userId: string, roleId: number, projectMemberId: string): Promise<boolean> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: true },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Validar que el usuario es project_member del proyecto
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, task.process.idproject!);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para asignar miembros a tareas en este proyecto');
    }

    // Validar que el usuario a asignar pertenece al proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: task.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new BadRequestException('El usuario no pertenece al proyecto');
    }

    // Verificar que no esté ya asignado
    const existingTaskMember = await this.prisma.task_member.findFirst({
      where: {
        idtask: taskId,
        iduser: userId,
      },
    });
    if (existingTaskMember) {
      throw new BadRequestException('El usuario ya está asignado a esta tarea');
    }

    // Crear la asignación
    await this.prisma.task_member.create({
      data: {
        idtask: taskId,
        iduser: userId,
        idrole: roleId,
        assigned_at: new Date(),
      },
    });

    return true;
  }

  async removeTaskMember(taskId: string, userId: string, projectMemberId: string): Promise<boolean> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: true },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Validar que el usuario es project_member del proyecto
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, task.process.idproject!);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para remover miembros de tareas en este proyecto');
    }

    // Verificar que el task_member existe
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        idtask: taskId,
        iduser: userId,
      },
    });
    if (!taskMember) {
      throw new BadRequestException('El usuario no está asignado a esta tarea');
    }

    // Remover la asignación
    await this.prisma.task_member.delete({
      where: { id: taskMember.id },
    });

    return true;
  }

  async getProcessTasksAsMember(processId: string, projectMemberId: string): Promise<Task[]> {
    // Validar que el usuario es project_member del proyecto
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });
    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    const isProjectMember = await this.userService.isProjectMember(projectMemberId, process.idproject!);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para ver las tareas de este proceso');
    }

    const tasks = await this.prisma.task.findMany({
      where: { idprocess: processId },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
            role: true,
          },
        },
        comment: {
          include: {
            user: true,
          },
        },
        evidence: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { editedat: 'desc' },
    });

    return tasks.map(task => this.mapTask(task));
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    // Validar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
      include: { process: { include: { project: true } } },
    });
    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Validar permisos para eliminar tareas
    if (!existingTask.process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canDeleteTask = await this.canCreateTask(existingTask.process.idproject, userId);
    if (!canDeleteTask) {
      throw new ForbiddenException('No tienes permisos para eliminar esta tarea');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return true;
  }

  async archiveTaskWithEvidences(taskId: string, userId: string | null): Promise<Task> {
    // 1. Obtener la tarea con toda su información
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: { include: { project: true } },
        user: true,
        user_task_archived_byTouser: true,
      },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (existingTask.archived_at) {
      throw new BadRequestException('La tarea ya está archivada');
    }

    // 2. Obtener todas las evidencias NO archivadas de la tarea
    const activeEvidences = await this.prisma.evidence.findMany({
      where: {
        idtask: taskId,
        archived_at: null,
      },
    });

    // 3. Archivar todas las evidencias en cascada (archived_by = null)
    if (activeEvidences.length > 0) {
      await this.prisma.evidence.updateMany({
        where: {
          id: { in: activeEvidences.map(e => e.id) },
        },
        data: {
          archived_at: new Date(),
          archived_by: null, // Cascada automática
        },
      });
    }

    // 4. Archivar la tarea
    const archivedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        archived_at: new Date(),
        archived_by: userId,
      },
      include: {
        user: true,
        process: true,
        user_task_archived_byTouser: true,
      },
    });

    // 5. Verificar si todas las tareas del proceso están archivadas
    const processId = existingTask.idprocess;
    await this.checkAndArchiveProcess(processId);

    return this.mapTask(archivedTask);
  }

  /**
   * Verifica si todas las tareas de un proceso están archivadas
   * Si es así, archiva el proceso automáticamente
   */
  private async checkAndArchiveProcess(processId: string): Promise<void> {
    // Contar total de tareas del proceso
    const totalTasks = await this.prisma.task.count({
      where: { idprocess: processId },
    });

    // Contar tareas archivadas del proceso
    const archivedTasks = await this.prisma.task.count({
      where: {
        idprocess: processId,
        archived_at: { not: null },
      },
    });

    // Si todas están archivadas y hay al menos una tarea, archivar el proceso
    if (totalTasks > 0 && totalTasks === archivedTasks) {
      // Verificar que el proceso no esté ya archivado
      const process = await this.prisma.process.findUnique({
        where: { id: processId },
      });

      if (process && !process.archived_at) {
        await this.archiveProcessOnly(processId, null); // userId=null porque es automático
      }
    }
  }

  async unarchiveTask(taskId: string, userId: string): Promise<Task> {
    // Validar que la tarea existe y está archivada
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (!existingTask.archived_at) {
      throw new BadRequestException('La tarea no está archivada');
    }

    // Validar permisos
    if (!existingTask.process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canEdit = await this.canCreateTask(existingTask.process.idproject, userId);
    if (!canEdit) {
      throw new ForbiddenException('No tienes permisos para desarchivar esta tarea');
    }

    // Desarchivar la tarea (las evidencias permanecen archivadas)
    const unarchivedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        archived_at: null,
        archived_by: null,
      },
      include: {
        user: true,
        process: true,
        user_task_archived_byTouser: true,
      },
    });

    return this.mapTask(unarchivedTask);
  }


  async unarchiveTaskWithEvidences(taskId: string, userId: string): Promise<Task> {
    // Validar que la tarea existe y está archivada
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    if (!existingTask.archived_at) {
      throw new BadRequestException('La tarea no está archivada');
    }

    // Validar permisos
    if (!existingTask.process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canEdit = await this.canCreateTask(existingTask.process.idproject, userId);
    if (!canEdit) {
      throw new ForbiddenException('No tienes permisos para desarchivar esta tarea');
    }

    // 1. Obtener todas las evidencias archivadas de la tarea
    const archivedEvidences = await this.prisma.evidence.findMany({
      where: {
        idtask: taskId,
        archived_at: { not: null },
      },
    });

    // 2. Desarchivar todas las evidencias en cascada
    if (archivedEvidences.length > 0) {
      await this.prisma.evidence.updateMany({
        where: {
          id: { in: archivedEvidences.map(e => e.id) },
        },
        data: {
          archived_at: null,
          archived_by: null,
        },
      });
    }

    // 3. Desarchivar la tarea
    const unarchivedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        archived_at: null,
        archived_by: null,
      },
      include: {
        user: true,
        process: true,
        user_task_archived_byTouser: true,
      },
    });

    return this.mapTask(unarchivedTask);
  }

  // ==================== HELPER METHODS ====================

  private mapProcess(process: any): Process {
    return {
      id: process.id,
      name: process.name,
      description: process.description,
      startDate: process.startdate,
      dueDate: process.duedate,
      editedAt: process.editedat,
      editor: process.user,
      review: process.review,
      archivedAt: process.archived_at,
      archivedBy: process.archived_by,
      archivedByUser: process.user_process_archived_byTouser,
      projectId: process.idproject,
      project: process.project,
      createdAt: process.createdat,
      updatedAt: process.updatedat,
    };
  }

  async getTaskMembers(taskId: string): Promise<any[]> {
    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Obtener los miembros de la tarea
    const taskMembers = await this.prisma.task_member.findMany({
      where: { idtask: taskId },
      include: {
        user: true,
        role: true,
      },
      orderBy: { assigned_at: 'desc' },
    });

    return taskMembers.map(tm => ({
      id: tm.id,
      taskId: tm.idtask,
      userId: tm.iduser,
      roleId: tm.idrole,
      assignedAt: tm.assigned_at,
      user: tm.user,
      role: tm.role,
    }));
  }

  private mapTask(task: any): Task {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      startDate: task.startdate,
      dueDate: task.duedateat,
      status: task.status,
      editedAt: task.editedat,
      editor: task.user,
      report: task.report,
      budget: task.budget,
      expense: task.expense,
      archivedAt: task.archived_at,
      archivedBy: task.archived_by,
      archivedByUser: task.user_task_archived_byTouser,
      processId: task.idprocess,
      process: task.process,
      createdAt: task.createdat,
      updatedAt: task.updatedat,
    };
  }

  // ==================== TASK REACTIVATION METHODS ====================

  async reactivateTask(taskId: string, userId: string): Promise<Task> {
    // Verificar permisos jerárquicos: super_admin, admin, o area_member
    const canReactivate = await this.userService.canPerformTaskAction(userId, taskId, 'reactivate');
    if (!canReactivate) {
      throw new ForbiddenException('No tienes permisos para reactivar esta tarea');
    }

    // Verificar que la tarea existe y obtener información del proceso/proyecto
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Reactivar la tarea (cambiar estado a pending y desarchivar si está archivada)
    const reactivatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        editedat: new Date(),
        ideditor: userId,
        archived_at: null,  // Desarchivar automáticamente
        archived_by: null,
      },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    // Crear log de actividad para la reactivación
    await this.prisma.logs.create({
      data: {
        type: 'TASK_REACTIVATED',
        idcreator: userId,
        idtask: taskId,
        idprocess: existingTask.idprocess,
        idproject: existingTask.process.idproject || undefined,
        createdat: new Date(),
      },
    });

    return this.mapTask(reactivatedTask);
  }

  async getAreaProjects(auditorId: string): Promise<any[]> {
    // Obtener el área del auditor
    const auditorArea = await this.userService.getAreaMemberArea(auditorId);
    if (!auditorArea) {
      throw new ForbiddenException('No tienes un área asignada');
    }

    // Obtener todos los proyectos del área del auditor
    const projects = await this.prisma.project.findMany({
      where: {
        category: {
          id_area: auditorArea,
        },
      },
      include: {
        category: true,
        process: {
          include: {
            task: true,
          },
        },
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return projects;
  }

  async getAvailableUsersForTask(taskId: string, currentUser: User): Promise<any[]> {
    // Verificar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: {
          include: {
            project: {
              include: {
                project_member: {
                  include: {
                    user: true,
                    role: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!task) {
      throw new NotFoundException(`Tarea con ID ${taskId} no encontrada`);
    }

    // Verificar que el proceso y proyecto existen
    if (!task.process || !task.process.project) {
      throw new NotFoundException('Proceso o proyecto no encontrado para esta tarea');
    }

    // Verificar permisos: solo project_members pueden ver usuarios disponibles para tareas
    const isProjectMember = await this.userService.isProjectMember(currentUser.id, task.process.project.id);
    const isSuperAdmin = await this.userService.isSuperAdmin(currentUser.id);

    if (!isProjectMember && !isSuperAdmin) {
      throw new ForbiddenException('Solo los miembros del proyecto pueden ver usuarios disponibles para tareas');
    }

    // Obtener usuarios que ya son task_members de esta tarea
    const existingTaskMembers = await this.prisma.task_member.findMany({
      where: { idtask: taskId },
      select: { iduser: true }
    });

    const existingTaskMemberIds = existingTaskMembers.map(member => member.iduser);

    // Obtener todos los project_members del proyecto (son elegibles para ser task_members)
    const projectMembers = task.process.project.project_member || [];

    // Filtrar usuarios: solo project_members que NO sean ya task_members de esta tarea
    const availableUsers = projectMembers.filter(member => {
      return member.user && !existingTaskMemberIds.includes(member.user.id);
    });

    // Mapear a formato esperado (con null safety)
    return availableUsers
      .filter(member => member.user) // Asegurar que user no es null
      .map(member => ({
        id: member.user!.id,
        name: member.user!.name || '',
        email: member.user!.email,
        isActive: member.user!.isactive ?? true,
        havePassword: member.user!.havepassword ?? false,
        role: {
          id: member.role?.id || 0,
          name: member.role?.name || '',
        },
        projectMembership: {
          id: member.id,
          projectId: task.process!.project!.id,
          roleId: member.idrole
        }
      }));
  }


  async unarchiveProcessWithTasks(processId: string, userId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
    });

    if (!process) throw new NotFoundException('Proceso no encontrado');

    if (!process.archived_at) {
      throw new BadRequestException('El proceso no está archivado');
    }

    // Desarchivar tareas del proceso
    await this.prisma.task.updateMany({
      where: { idprocess: processId },
      data: { archived_at: null, archived_by: null },
    });

    const archivedTasks = await this.prisma.task.findMany({
      where: {
        idprocess: processId,
        archived_at: null,
      },
    });

    // 🔁 Desarchivar evidencias y tareas del proceso
    for (const task of archivedTasks) {
      // Desarchivar evidencias asociadas
      await this.unarchiveTaskWithEvidences(task.id, userId);
    }

    // Finalmente, desarchivar el proceso
    return this.prisma.process.update({
      where: { id: processId },
      data: {
        archived_at: null,
        archived_by: null,
      },
    });
  }
}
