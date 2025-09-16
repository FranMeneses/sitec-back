import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { Process } from './entities/process.entity';
import { Task } from './entities/task.entity';
import { CreateProcessInput, UpdateProcessInput } from './dto/process.dto';
import { CreateTaskInput, UpdateTaskInput, TaskStatus } from './dto/task.dto';
import { TaskMember } from './entities/task-member.entity';

@Injectable()
export class ProcessService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) { }

  // ==================== HELPER METHODS ====================

  private async canAccessProject(projectId: string, userId: string): Promise<boolean> {
    // Super admin puede hacer cualquier cosa
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin del sistema puede hacer cualquier cosa
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) return true;

    // Verificar si es project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });

    return !!projectMember;
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

  async findAllProcesses(userId?: string): Promise<Process[]> {
    const processes = await this.prisma.process.findMany({
      include: {
        user: true, // editor
        project: true,
      },
      orderBy: { name: 'asc' },
    });

    return processes.map(process => this.mapProcess(process));
  }

  async findProcessById(id: string): Promise<Process | null> {
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: {
        user: true, // editor
        project: true,
      },
    });

    if (!process) return null;
    return this.mapProcess(process);
  }

  async findProcessesByProject(projectId: string): Promise<Process[]> {
    const processes = await this.prisma.process.findMany({
      where: { idproject: projectId },
      include: {
        user: true, // editor
        project: true,
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

  // ==================== TASK METHODS ====================

  async findAllTasks(userId?: string): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      include: {
        user: true, // editor
        process: true,
      },
      orderBy: { name: 'asc' },
    });

    return tasks.map(task => this.mapTask(task));
  }

  async findTaskById(id: string): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        user: true, // editor
        process: true,
      },
    });

    if (!task) return null;
    return this.mapTask(task);
  }

  async findTasksByProcess(processId: string): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      where: { idprocess: processId },
      include: {
        user: true, // editor
        process: true,
      },
      orderBy: { name: 'asc' },
    });

    return tasks.map(task => this.mapTask(task));
  }

  async findTasksByTaskId(taskId: string): Promise<Task[]> {
    // Esta query retorna la tarea específica con su proceso asociado
    // Es útil para obtener información completa de una tarea y su proceso
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: true, // editor
        process: true,
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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: process.idproject,
        iduser: editorId,
      },
    });
    if (!projectMember) {
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

    if (createTaskInput.memberAssignments && createTaskInput.memberAssignments.length > 0) {
      // Asignar los miembros especificados
      for (const assignment of createTaskInput.memberAssignments) {
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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingTask.process.idproject,
        iduser: editorId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para editar esta tarea');
    }

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

    // Solo permitir actualizar status, report, budget y expense
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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingTask.process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para eliminar esta tarea');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return true;
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
      processId: task.idprocess,
      process: task.process,
      createdAt: task.createdat,
      updatedAt: task.updatedat,
    };
  }

  // ==================== AREA_MEMBER (AUDITOR) METHODS ====================

  async reactivateTask(taskId: string, auditorId: string): Promise<Task> {
    // Verificar que el auditor puede reactivar esta tarea
    const canReactivate = await this.userService.canAreaMemberReactivateTask(auditorId, taskId);
    if (!canReactivate) {
      throw new ForbiddenException('No tienes permisos para reactivar esta tarea');
    }

    // Verificar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { process: { include: { project: true } } },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Verificar que la tarea está en un estado que permite reactivación
    if (!['cancelled', 'completed'].includes(existingTask.status || '')) {
      throw new BadRequestException('Solo se pueden reactivar tareas canceladas o completadas');
    }

    // Reactivar la tarea (cambiar estado a pending)
    const reactivatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        editedat: new Date(),
        ideditor: auditorId,
      },
      include: {
        user: true,
        process: true,
      },
    });

    // Crear log de reactivación
    await this.prisma.logs.create({
      data: {
        type: 'task_reactivated',
        idcreator: auditorId,
        idtask: taskId,
        idprocess: existingTask.idprocess,
        idproject: existingTask.process.idproject,
      },
    });

    return this.mapTask(reactivatedTask);
  }

  async getAreaProjectsForAudit(auditorId: string): Promise<any[]> {
    // Obtener el área del auditor
    const auditorArea = await this.userService.getAreaMemberArea(auditorId);
    if (!auditorArea) {
      throw new ForbiddenException('No tienes un área asignada para auditar');
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
            task: {
              include: {
                task_member: {
                  include: {
                    user: true,
                    role: true,
                  },
                },
              },
            },
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

  async generateAuditReport(auditorId: string, projectId?: string): Promise<any> {
    // Verificar permisos del auditor
    const auditorArea = await this.userService.getAreaMemberArea(auditorId);
    if (!auditorArea) {
      throw new ForbiddenException('No tienes un área asignada para auditar');
    }

    let whereClause: any = {
      category: {
        id_area: auditorArea,
      },
    };

    if (projectId) {
      // Verificar que el proyecto pertenece al área del auditor
      const canAudit = await this.userService.canAreaMemberPerformProjectAction(auditorId, projectId, 'audit');
      if (!canAudit) {
        throw new ForbiddenException('No tienes permisos para auditar este proyecto');
      }
      whereClause.id = projectId;
    }

    // Generar reporte de auditoría
    const projects = await this.prisma.project.findMany({
      where: whereClause,
      include: {
        category: true,
        process: {
          include: {
            task: {
              include: {
                task_member: {
                  include: {
                    user: true,
                    role: true,
                  },
                },
                evidence: true,
                comment: true,
              },
            },
          },
        },
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
        logs: {
          where: {
            type: {
              in: ['task_reactivated', 'task_completed', 'task_cancelled'],
            },
          },
          orderBy: {
            createdat: 'desc',
          },
        },
      },
    });

    // Procesar estadísticas
    const auditReport = projects.map(project => {
      const totalTasks = project.process.reduce((acc, process) => acc + process.task.length, 0);
      const completedTasks = project.process.reduce((acc, process) => 
        acc + process.task.filter(task => task.status === 'completed').length, 0
      );
      const cancelledTasks = project.process.reduce((acc, process) => 
        acc + process.task.filter(task => task.status === 'cancelled').length, 0
      );
      const reactivatedTasks = project.logs.filter(log => log.type === 'task_reactivated').length;

      return {
        projectId: project.id,
        projectName: project.name,
        category: project.category?.name,
        totalTasks,
        completedTasks,
        cancelledTasks,
        reactivatedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        recentActivity: project.logs.slice(0, 10), // Últimas 10 actividades
      };
    });

    return auditReport;
  }
}
