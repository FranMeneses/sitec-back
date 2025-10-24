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

  /**
   * Calcula el porcentaje automático basado en el status de la tarea
   */
  private getAutomaticPercentage(status: string, lastPercent?: number): number {
    // Normalizar el status a minúsculas para comparación
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case 'pending':
        return 0;
      case 'in_progress':
        return 50;
      case 'review':
        return 80;
      case 'completed':
        return 100;
      case 'cancelled':
        return lastPercent || 0; // Mantener el último valor o 0 si no hay
      default:
        return 0;
    }
  }

  private async canAccessProject(projectId: string, userId: string): Promise<boolean> {
    // 1️⃣ Super admin puede hacer cualquier cosa
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // 2️⃣ Obtener proyecto con su categoría y área
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

    if (!project || !project.category) return false;

    const areaId = project.category.id_area;

    // 3️⃣ Obtener todas las áreas donde el usuario participa (admin o miembro)
    const [adminAreas, memberAreas] = await Promise.all([
      this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
      this.prisma.area_member.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
    ]);

    const userAreas = new Set([
      ...adminAreas.map(a => a.idarea),
      ...memberAreas.map(m => m.idarea),
    ]);

    // Si pertenece al área, acceso permitido
    if (userAreas.has(areaId)) return true;

    // 4️⃣ Verificar si es project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });
    if (projectMember) return true;

    // 5️⃣ Verificar si es unit_member de la unidad del proyecto
    if (project.idunit) {
      const unitMember = await this.prisma.unit_member.findFirst({
        where: {
          iduser: userId,
          idunit: project.idunit,
        },
      });
      if (unitMember) return true;
    }

    // 6️⃣ Verificar si es task_member de alguna tarea del proyecto
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        iduser: userId,
        task: {
          process: {
            idproject: projectId,
          },
        },
      },
    });

    return !!taskMember;
  }

  private async canCreateTask(projectId: string, userId: string): Promise<boolean> {
    // 1️⃣ Super admin puede crear tareas en cualquier proyecto
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // 2️⃣ Obtener el proyecto con su categoría y área
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

    if (!project || !project.category) return false;

    const areaId = project.category.id_area;

    // 3️⃣ Obtener todas las áreas donde el usuario participa (admin o miembro)
    const [adminAreas, memberAreas] = await Promise.all([
      this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
      this.prisma.area_member.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
    ]);

    const userAreas = new Set([
      ...adminAreas.map(a => a.idarea),
      ...memberAreas.map(m => m.idarea),
    ]);

    // 4️⃣ Si pertenece al área, puede crear tareas
    if (userAreas.has(areaId)) return true;

    // 5️⃣ Verificar si es project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });
    if (projectMember) return true;

    // 6️⃣ Verificar si es task_member de alguna tarea del proyecto
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        iduser: userId,
        task: {
          process: {
            idproject: projectId,
          },
        },
      },
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
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { startdate: true, duedate: true }
    });

    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Validar fechas entre sí
    this.validateTaskDates(startDate, dueDate);

    // Función para normalizar (eliminar horas y zonas)
    const normalize = (date: string | Date): Date => {
      const d = new Date(date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const processStart = process.startdate ? normalize(process.startdate) : null;
    const processDue = process.duedate ? normalize(process.duedate) : null;
    const taskStart = startDate ? normalize(startDate) : null;
    const taskDue = dueDate ? normalize(dueDate) : null;

    function normalizeToUTCStart(date: Date): Date {
      const d = new Date(date);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }

    // Validar inicio
    if (processStart && taskStart) {
      const ps = normalizeToUTCStart(processStart);
      const ts = normalizeToUTCStart(taskStart);

      if (ts < ps) {
        throw new BadRequestException(
          'La fecha de inicio de la tarea no puede ser anterior a la fecha de inicio del proceso'
        );
      }
    }

    // Validar fin
    if (processDue && taskDue && taskDue > processDue) {
      throw new BadRequestException(
        'La fecha de vencimiento de la tarea no puede ser posterior a la fecha de vencimiento del proceso'
      );
    }

    // Validar rango completo
    if (processStart && processDue) {
      if (taskStart && (taskStart < processStart || taskStart > processDue)) {
        throw new BadRequestException(
          'La fecha de inicio de la tarea debe estar dentro del rango de fechas del proceso'
        );
      }

      if (taskDue && (taskDue < processStart || taskDue > processDue)) {
        throw new BadRequestException(
          'La fecha de vencimiento de la tarea debe estar dentro del rango de fechas del proceso'
        );
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

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'PROCESS_CREATED',
        idcreator: editorId,
        idproject: createProcessInput.projectId,
        idprocess: process.id,
        createdat: new Date(),
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

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'PROCESS_UPDATED',
        idcreator: editorId,
        idproject: existingProcess.idproject,
        idprocess: process.id,
        createdat: new Date(),
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

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'PROCESS_DELETED',
        idcreator: userId,
        idproject: existingProcess.idproject,
        idprocess: id,
        createdat: new Date(),
      },
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
  // ==================== PROCESS METHODS - ROLE BASED ====================

  /**
   * Retorna todos los procesos que el usuario puede ver según su rol y permisos
   * - super_admin: todos los procesos
   * - area_role: procesos de proyectos en sus áreas o donde es miembro
   * - unit_role: procesos de proyectos en sus unidades o donde es miembro
   * - user: procesos de proyectos donde es miembro
   */
  async findAllProcessesArchived(userId?: string, includeArchived = false): Promise<Process[]> {
    if (!userId) {
      throw new ForbiddenException('Debe estar autenticado para ver procesos');
    }

    // Obtener el rol del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true },
    });

    const currentRole = userSystemRole?.role?.name;
    let processes: any[] = [];

    const DEFAULT_INCLUDE = {
      project: {
        include: {
          category: { include: { area: true } },
          unit: { include: { type: true } },
          user: true,
        },
      },
      user: true, // creador del proceso
      processTasks: {
        include: {
          user: true, // si las tareas tienen responsable
          // evidence: true, // descomenta si quieres incluir evidencias
          // status: true,   // idem para estado u otras relaciones
        },
      },
    };
    switch (currentRole) {
      case 'super_admin':
        // 🔹 Superadmin ve todos los procesos (excepto eliminados)
        processes = await this.prisma.process.findMany({
          where: {

            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
          },
          include: DEFAULT_INCLUDE,
          orderBy: { name: 'asc' },
        });
        break;

      case 'area_role': {
        // 🔹 Obtener áreas del usuario
        const userAreas = await this.prisma.area_member.findMany({
          where: { iduser: userId },
          select: { idarea: true },
        });

        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true },
        });
        if (adminArea) userAreas.push({ idarea: adminArea.idarea! });

        const areaIds = [...new Set(userAreas.map((a) => a.idarea))];

        // 🔹 Obtener proyectos donde el usuario es miembro
        const projectMemberships = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true },
        });
        const projectIds = projectMemberships.map((pm) => pm.idproject);

        // 🔹 Filtros combinados: proyectos del área o donde participa
        const areaWhereConditions: any[] = [];
        if (areaIds.length > 0) {
          areaWhereConditions.push({
            project: { category: { id_area: { in: areaIds } } },
          });
        }
        if (projectIds.length > 0) {
          areaWhereConditions.push({ projectId: { in: projectIds } });
        }

        processes = await this.prisma.process.findMany({
          where: {
            OR: areaWhereConditions,

            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
          },
          include: DEFAULT_INCLUDE,
          orderBy: { name: 'asc' },
        });
        break;
      }

      case 'unit_role': {
        // 🔹 Obtener unidades del usuario
        const userUnits = await this.prisma.unit_member.findMany({
          where: { iduser: userId },
          select: { idunit: true },
        });
        const unitIds = userUnits.map((u) => u.idunit);

        // 🔹 Obtener proyectos donde es miembro
        const projectMemberships = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true },
        });
        const projectIds = projectMemberships.map((pm) => pm.idproject);

        // 🔹 Filtros combinados: proyectos de la unidad o donde participa
        const unitWhereConditions: any[] = [];
        if (unitIds.length > 0) {
          unitWhereConditions.push({
            project: { idunit: { in: unitIds } },
          });
        }
        if (projectIds.length > 0) {
          unitWhereConditions.push({ projectId: { in: projectIds } });
        }

        processes = await this.prisma.process.findMany({
          where: {
            OR: unitWhereConditions,

            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
          },
          include: DEFAULT_INCLUDE,
          orderBy: { name: 'asc' },
        });
        break;
      }
      case 'user':
      default: {
        // 🔹 User ve procesos de los proyectos donde es miembro
        const userProjects = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true },
        });
        const projectIds = userProjects
          .map((p) => p.idproject)
          .filter((id): id is string => id !== null); // Filter out null values

        if (projectIds.length === 0) {
          processes = [];
        } else {
          processes = await this.prisma.process.findMany({
            where: {
              project: {
                id: { in: projectIds }, // Use the `project` relationship to filter by `id`
              },
              ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED),
            },
            include: DEFAULT_INCLUDE,
            orderBy: { name: 'asc' },
          });
        }
        break;
      }
    }

    return processes.map((process) => this.mapProcess(process));
  }
  // ==================== TASK METHODS ====================

  async findAllTasks(userId?: string, includeArchived = false): Promise<Task[]> {
    // Si no hay userId, devolver todas las tareas (caso de admin/super_admin)
    if (!userId) {
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

    // Obtener el rol del usuario para determinar qué tareas puede ver
    const userWithRoles = await this.userService.findByIdWithRoles(userId);
    const userSystemRole = userWithRoles?.systemRole?.role?.name;

    // Si el usuario tiene rol "user", solo puede ver tareas donde es task_member
    if (userSystemRole === 'user') {
      const userAssignedTasks = await this.userService.findUserAssignedTasks(userId, includeArchived);
      // Convertir el formato de findUserAssignedTasks al formato esperado por Task[]
      return userAssignedTasks.map(tm => tm.task);
    }

    // Para otros roles (admin, area_role, unit_role), devolver todas las tareas
    // TODO: Aquí se podrían agregar más filtros específicos por rol en el futuro
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

  async findTaskById(id: string, includeArchived = false, userId?: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        user: true, // editor
        process: true,
        user_task_archived_byTouser: true, // archived by user
        comment: {
          include: { user: true },
          orderBy: { created_at: 'desc' }
        },
        evidence: {
          include: { user: true },
          orderBy: { uploadedat: 'desc' }
        },
        task_member: {
          include: {
            user: true,
          }
        }
      },
    });

    if (!task) return null;

    // Si no incluimos archivadas y está archivada, retornar null
    if (!includeArchived && task.archived_at) return null;

    // Si se proporciona userId, verificar permisos según el rol
    if (userId) {
      const userWithRoles = await this.userService.findByIdWithRoles(userId);
      const userSystemRole = userWithRoles?.systemRole?.role?.name;

      // Si el usuario tiene rol "user", solo puede ver tareas donde es task_member
      if (userSystemRole === 'user') {
        const isTaskMember = await this.userService.isTaskMember(userId, id);
        if (!isTaskMember) {
          return null; // No tiene permisos para ver esta tarea
        }
      }
    }

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
    // Calcular porcentaje inicial basado en el status
    const initialPercent = createTaskInput.percent !== undefined
      ? createTaskInput.percent
      : this.getAutomaticPercentage(createTaskInput.status);

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
        expense: createTaskInput.expense,
        review: createTaskInput.review,
        percent: initialPercent,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
          },
        },
      },
    });

    // Auto-asignar al creador (project_member) como task_member
    await this.prisma.task_member.create({
      data: {
        idtask: task.id,
        iduser: editorId, // El project_member que creó la tarea
        assigned_at: new Date(),
      },
    });

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
          },
        },
      },
    });

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'TASK_CREATED',
        idcreator: editorId,
        idproject: process.idproject,
        idprocess: createTaskInput.processId,
        idtask: task.id,
        createdat: new Date(),
      },
    });

    // Siempre recalcular el porcentaje del proceso cuando se crea una tarea
    await this.updateProcessPercentage(createTaskInput.processId);

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

    // Calcular el nuevo porcentaje
    let newPercent = existingTask.percent;

    if (updateTaskInput.percent !== undefined) {
      // Si se proporciona porcentaje manual, usarlo
      newPercent = updateTaskInput.percent;
    } else if (updateTaskInput.status && updateTaskInput.status.toLowerCase() !== existingTask.status?.toLowerCase()) {
      // Si solo cambió el status, calcular porcentaje automático
      newPercent = this.getAutomaticPercentage(updateTaskInput.status, existingTask.percent || undefined);
    }
    // Detectar si el estado cambió
    const statusChanged =
      updateTaskInput.status &&
      updateTaskInput.status.toLowerCase() !== existingTask.status?.toLowerCase();

    // Solo archivar si se cancela explícitamente
    const shouldArchive =
      statusChanged &&
      updateTaskInput.status &&
      updateTaskInput.status.toLowerCase() === TaskStatus.CANCELLED.toLowerCase();
    // 🔹 Si debe archivarse (solo si archive = true o se cancela)
    if (shouldArchive) {
      const updateData: any = {
        ideditor: editorId,
        percent: newPercent,
        editedat: new Date(),
      };

      if (updateTaskInput.name !== undefined) updateData.name = updateTaskInput.name;
      if (updateTaskInput.description !== undefined) updateData.description = updateTaskInput.description;
      if (updateTaskInput.startDate !== undefined)
        updateData.startdate = updateTaskInput.startDate ? new Date(updateTaskInput.startDate) : null;
      if (updateTaskInput.dueDate !== undefined)
        updateData.duedateat = updateTaskInput.dueDate ? new Date(updateTaskInput.dueDate) : null;
      if (updateTaskInput.status !== undefined) updateData.status = updateTaskInput.status;
      if (updateTaskInput.report !== undefined) updateData.report = updateTaskInput.report;
      if (updateTaskInput.expense !== undefined) updateData.expense = updateTaskInput.expense;
      if (updateTaskInput.review !== undefined) updateData.review = updateTaskInput.review;

      await this.prisma.task.update({
        where: { id: updateTaskInput.id },
        data: updateData,
      });

      await this.updateProcessPercentage(existingTask.idprocess);


      return await this.archiveTaskWithEvidences(updateTaskInput.id, editorId);
    }
    // Actualización normal (sin archivar)
    // Preparar datos de actualización solo con campos proporcionados
    const updateData: any = {
      ideditor: editorId,
      percent: newPercent,
      editedat: new Date(),
    };

    if (updateTaskInput.name !== undefined) updateData.name = updateTaskInput.name;
    if (updateTaskInput.description !== undefined) updateData.description = updateTaskInput.description;
    if (updateTaskInput.startDate !== undefined) updateData.startdate = updateTaskInput.startDate ? new Date(updateTaskInput.startDate) : null;
    if (updateTaskInput.dueDate !== undefined) updateData.duedateat = updateTaskInput.dueDate ? new Date(updateTaskInput.dueDate) : null;
    if (updateTaskInput.status !== undefined) updateData.status = updateTaskInput.status;
    if (updateTaskInput.report !== undefined) updateData.report = updateTaskInput.report;
    if (updateTaskInput.expense !== undefined) updateData.expense = updateTaskInput.expense;
    if (updateTaskInput.review !== undefined) updateData.review = updateTaskInput.review;

    const task = await this.prisma.task.update({
      where: { id: updateTaskInput.id },
      data: updateData,
      include: {
        user: true,
        process: true,
        task_member: {
          include: {
            user: true,
          },
        },
      },
    });

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'TASK_UPDATED',
        idcreator: editorId,
        idproject: existingTask.process.idproject,
        idprocess: existingTask.idprocess,
        idtask: task.id,
        createdat: new Date(),
      },
    });

    // Siempre recalcular el porcentaje del proceso cuando se actualiza una tarea
    await this.updateProcessPercentage(existingTask.idprocess);

    return this.mapTask(task);
  }

  async updateTaskAsMember(updateTaskInput: { id: string; status?: string; report?: string; expense?: number }, memberId: string): Promise<Task> {
    // Verificar permisos del usuario basado en rol y membresías
    const userWithRoles = await this.userService.findByIdWithRoles(memberId);
    const userSystemRole = userWithRoles?.systemRole?.role?.name;

    // Si es usuario "user", verificar que tenga membresías apropiadas
    if (userSystemRole === 'user') {
      const hasProjectMembership = userWithRoles?.projectMemberships?.length > 0;
      const hasTaskMembership = userWithRoles?.taskMemberships?.length > 0;

      if (!hasProjectMembership && !hasTaskMembership) {
        throw new ForbiddenException('Los usuarios sin membresías de proyecto o tarea no pueden editar tareas.');
      }
      // Si tiene membresías, continuar con la validación específica más abajo
    }

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

    // Validación adicional para usuarios "user": verificar membresías específicas
    if (userSystemRole === 'user') {
      const isProjectMember = await this.userService.isProjectMember(memberId, existingTask.process.idproject!);

      // Si es project_member del proyecto, puede editar cualquier tarea del proyecto
      // Si NO es project_member pero SÍ es task_member, puede editar solo esta tarea
      // (ya validamos que es task_member arriba)

      if (!isProjectMember) {
        // Solo puede editar como task_member (permisos limitados)
        // Podemos agregar restricciones adicionales aquí si es necesario
        console.log(`Usuario ${memberId} editando tarea ${updateTaskInput.id} como task_member únicamente`);
      } else {
        // Puede editar como project_member (permisos completos en el proyecto)
        console.log(`Usuario ${memberId} editando tarea ${updateTaskInput.id} como project_member`);
      }
    }

    // Detectar si el estado cambió a COMPLETED o CANCELLED
    const statusChanged =
      updateTaskInput.status &&
      updateTaskInput.status !== existingTask.status;

    // Solo archivar si se cancela explícitamente
    const shouldArchive =
      statusChanged &&
      updateTaskInput.status === 'cancelled';
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

    // Sincronizar expenses si se actualizó el expense
    if (updateTaskInput.expense !== undefined) {
      await this.syncProcessExpense(task.idprocess);
      await this.syncProjectExpense(task.process.idproject!);
    }

    return this.mapTask(task);
  }

  // ==================== TASK_MEMBER METHODS ====================

  async assignTaskMember(taskId: string, userId: string, projectMemberId: string): Promise<boolean> {
    // Verificar permisos del usuario basado en rol y membresías
    const userWithRoles = await this.userService.findByIdWithRoles(projectMemberId);
    const userSystemRole = userWithRoles?.systemRole?.role?.name;

    // Si es usuario "user", debe ser project_member para gestionar task_members
    if (userSystemRole === 'user') {
      const hasProjectMembership = userWithRoles?.projectMemberships?.length > 0;

      if (!hasProjectMembership) {
        throw new ForbiddenException('Los usuarios "user" solo pueden gestionar task_members si son project_member del proyecto.');
      }
      // Si es project_member, continuar con validación específica del proyecto más abajo
    }

    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: true },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }

    // Validar permisos para asignar task_members
    const canAssignTaskMembers = await this.canAssignTaskMembers(projectMemberId, task.process.idproject!);
    if (!canAssignTaskMembers) {
      throw new ForbiddenException('No tienes permisos para asignar miembros a tareas en este proyecto');
    }

    // Ya no es necesario que el usuario a asignar sea project_member
    // Los unit_member pueden asignar cualquier usuario como task_member

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
        assigned_at: new Date(),
      },
    });

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'TASK_ASSIGNED',
        idcreator: projectMemberId,
        idproject: task.process.idproject,
        idprocess: task.idprocess,
        idtask: taskId,
        createdat: new Date(),
      },
    });

    return true;
  }

  async removeTaskMember(taskId: string, userId: string, projectMemberId: string): Promise<boolean> {
    // Verificar permisos del usuario basado en rol y membresías
    const userWithRoles = await this.userService.findByIdWithRoles(projectMemberId);
    const userSystemRole = userWithRoles?.systemRole?.role?.name;

    // Si es usuario "user", debe ser project_member para gestionar task_members
    if (userSystemRole === 'user') {
      const hasProjectMembership = userWithRoles?.projectMemberships?.length > 0;

      if (!hasProjectMembership) {
        throw new ForbiddenException('Los usuarios "user" solo pueden gestionar task_members si son project_member del proyecto.');
      }
      // Si es project_member, continuar con validación específica del proyecto más abajo
    }

    // Validar que la tarea existe
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: true },
    });
    if (!task) {
      throw new BadRequestException('La tarea especificada no existe');
    }
    // Validar que el usuario es area_member del proyecto
    const canCreateTask = await this.canCreateTask(task.process.idproject!, projectMemberId);

    // Validar permisos para remover task_members
    const canRemoveTaskMembers = await this.canAssignTaskMembers(projectMemberId, task.process.idproject!);
    if (!canRemoveTaskMembers) {
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

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'MEMBER_REMOVED',
        idcreator: projectMemberId,
        idproject: task.process.idproject,
        idprocess: task.idprocess,
        idtask: taskId,
        createdat: new Date(),
      },
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

    // Crear log de actividad
    await this.prisma.logs.create({
      data: {
        type: 'TASK_DELETED',
        idcreator: userId,
        idproject: existingTask.process.idproject,
        idprocess: existingTask.idprocess,
        idtask: id,
        createdat: new Date(),
      },
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

    // if (!existingTask.archived_at) {
    //   throw new BadRequestException('La tarea no está archivada');
    // }

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

    // if (!existingTask.archived_at) {
    //   throw new BadRequestException('La tarea no está archivada');
    // }

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
      },
      orderBy: { assigned_at: 'desc' },
    });

    return taskMembers.map(tm => ({
      id: tm.id,
      taskId: tm.idtask,
      userId: tm.iduser,
      assignedAt: tm.assigned_at,
      user: tm.user,
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
      expense: task.expense,
      review: task.review,
      percent: task.percent,
      archivedAt: task.archived_at,
      archivedBy: task.archived_by,
      archivedByUser: task.user_task_archived_byTouser,
      processId: task.idprocess,
      process: task.process,
      createdAt: task.createdat,
      updatedAt: task.updatedat,
    };
  }

  /**
   * Verifica si un usuario puede asignar task_members
   * Permite tanto a project_member como a unit_member asignar task_members
   */
  private async canAssignTaskMembers(userId: string, projectId: string): Promise<boolean> {
    // 1️⃣ Super admin puede asignar miembros en cualquier proyecto
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // 2️⃣ Obtener el proyecto con su categoría y área
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        category: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!project || !project.category) return false;

    const areaId = project.category.id_area;

    // 3️⃣ Obtener todas las áreas donde el usuario participa (admin o miembro)
    const [adminAreas, memberAreas] = await Promise.all([
      this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
      this.prisma.area_member.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      }),
    ]);

    const userAreas = new Set([
      ...adminAreas.map(a => a.idarea),
      ...memberAreas.map(m => m.idarea),
    ]);

    // Si pertenece al área del proyecto, puede asignar task_members
    if (userAreas.has(areaId)) return true;

    // 4️⃣ Verificar si es project_member
    const isProjectMember = await this.userService.isProjectMember(userId, projectId);
    if (isProjectMember) return true;

    // 5️⃣ Verificar si es unit_member de la unidad asociada al proyecto
    if (project.idunit) {
      const isUnitMember = await this.prisma.unit_member.findFirst({
        where: {
          iduser: userId,
          idunit: project.idunit,
        },
      });
      if (isUnitMember) return true;
    }

    return false;
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

    // Obtener todos los usuarios (Unit_role)

    // Usuarios activos que no son ya task_members de esta tarea
    const usersNotInTask = await this.prisma.user.findMany({
      where: {
        isactive: true,
        id: {
          notIn: existingTaskMemberIds.length > 0 ? existingTaskMemberIds : undefined
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        system_role: {
          select: {
            role: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return usersNotInTask.map(user => ({
      id: user.id,
      name: user.name || '',
      email: user.email,
      isActive: true, // Ya filtramos por isactive: true
      havePassword: false, // No es relevante para esta consulta
      createdAt: new Date(), // Valores por defecto
      updatedAt: new Date(),
      systemRole: user.system_role ? {
        id: '',
        userId: user.id,
        roleId: 0,
        createdAt: new Date(),
        role: {
          id: 0,
          name: user.system_role.role.name || '',
          description: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } : undefined
    }));

    // Obtener todos los project_members del proyecto (son elegibles para ser task_members)
    // const projectMembers = task.process.project.project_member || [];

    // Filtrar usuarios: solo project_members que NO sean ya task_members de esta tarea
    // const availableUsers = projectMembers.filter(member => {
    //   return member.user && !existingTaskMemberIds.includes(member.user.id);
    // });

    // Mapear a formato esperado (con null safety)
    // return availableUsers
    //   .filter(member => member.user) // Asegurar que user no es null
    //   .map(member => ({
    //     id: member.user!.id,
    //     name: member.user!.name || '',
    //     email: member.user!.email,
    //     isActive: member.user!.isactive ?? true,
    //     havePassword: member.user!.havepassword ?? false,
    //     role: {
    //       id: 0, // En el nuevo esquema no hay roles específicos en project_member
    //       name: 'project_member', // Todos los project_member tienen el mismo propósito
    //     },
    //     projectMembership: {
    //       id: member.id,
    //       projectId: task.process!.project!.id,
    //     }
    //   }));
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

  // ==================== PERCENTAGE CALCULATION METHODS ====================

  /**
   * Calcula el porcentaje promedio de un proceso basado en sus tareas
   */
  async calculateProcessPercentage(processId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: {
        idprocess: processId,
        archived_at: null, // Solo tareas activas
      },
      select: {
        percent: true,
      },
    });

    if (tasks.length === 0) {
      return 0;
    }

    // Filtrar tareas que tienen porcentaje definido
    const tasksWithPercent = tasks.filter(task => task.percent !== null && task.percent !== undefined);

    if (tasksWithPercent.length === 0) {
      return 0;
    }

    // Calcular promedio
    const totalPercent = tasksWithPercent.reduce((sum, task) => sum + (task.percent || 0), 0);
    const averagePercent = Math.round(totalPercent / tasksWithPercent.length);

    return Math.min(100, Math.max(0, averagePercent)); // Asegurar que esté entre 0 y 100
  }

  /**
   * Actualiza el porcentaje de un proceso y recalcula el porcentaje del proyecto padre
   */
  async updateProcessPercentage(processId: string): Promise<void> {
    const newPercentage = await this.calculateProcessPercentage(processId);

    // Actualizar el porcentaje del proceso
    await this.prisma.process.update({
      where: { id: processId },
      data: { percent: newPercentage },
    });

    // Obtener el proyecto padre para recalcular su porcentaje
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { idproject: true },
    });

    if (process?.idproject) {
      // Recalcular el porcentaje del proyecto directamente
      await this.updateProjectPercentage(process.idproject);
    }
  }

  /**
   * Actualiza el porcentaje de un proyecto basado en sus procesos
   */
  async updateProjectPercentage(projectId: string): Promise<void> {
    const processes = await this.prisma.process.findMany({
      where: {
        idproject: projectId,
        archived_at: null, // Solo procesos activos
      },
      select: {
        percent: true,
      },
    });

    if (processes.length === 0) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { percent: 0 },
      });
      return;
    }

    // Filtrar procesos que tienen porcentaje definido
    const processesWithPercent = processes.filter(process => process.percent !== null && process.percent !== undefined);

    let averagePercent = 0;
    if (processesWithPercent.length > 0) {
      // Calcular promedio
      const totalPercent = processesWithPercent.reduce((sum, process) => sum + (process.percent || 0), 0);
      averagePercent = Math.round(totalPercent / processesWithPercent.length);
    }

    const finalPercent = Math.min(100, Math.max(0, averagePercent)); // Asegurar que esté entre 0 y 100

    // Actualizar el porcentaje del proyecto
    await this.prisma.project.update({
      where: { id: projectId },
      data: { percent: finalPercent },
    });
  }

  /**
   * Actualiza el porcentaje de una tarea y recalcula el porcentaje del proceso padre
   */
  async updateTaskPercentage(taskId: string, newPercent: number, userId: string): Promise<void> {
    // Validar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Validar permisos para editar tareas
    if (!existingTask.process.idproject) {
      throw new BadRequestException('El proceso no está asociado a un proyecto');
    }

    const canEditTask = await this.canCreateTask(existingTask.process.idproject, userId);
    if (!canEditTask) {
      throw new ForbiddenException('No tienes permisos para actualizar el porcentaje de esta tarea');
    }

    // Validar que el porcentaje esté entre 0 y 100
    const validPercent = Math.min(100, Math.max(0, newPercent));

    // Actualizar el porcentaje de la tarea
    await this.prisma.task.update({
      where: { id: taskId },
      data: { percent: validPercent },
    });

    // Obtener el proceso padre para recalcular su porcentaje
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { idprocess: true },
    });

    if (task?.idprocess) {
      await this.updateProcessPercentage(task.idprocess);
    }
  }

  // ==================== EXPENSE SYNCHRONIZATION METHODS ====================

  /**
   * Sincroniza el expense de un proceso con la suma de expenses de sus tareas
   */
  async syncProcessExpense(processId: string): Promise<void> {
    const totalExpense = await this.prisma.task.aggregate({
      where: { 
        idprocess: processId, 
        archived_at: null 
      },
      _sum: { expense: true }
    });

    await this.prisma.process.update({
      where: { id: processId },
      data: { expense: totalExpense._sum.expense || 0 }
    });
  }

  /**
   * Sincroniza el expense de un proyecto con la suma de expenses de sus procesos
   */
  async syncProjectExpense(projectId: string): Promise<void> {
    const totalExpense = await this.prisma.process.aggregate({
      where: { 
        idproject: projectId, 
        archived_at: null 
      },
      _sum: { expense: true }
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { expense: totalExpense._sum.expense || 0 }
    });
  }
}
