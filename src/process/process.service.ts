import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { Process } from './entities/process.entity';
import { Task } from './entities/task.entity';
import { CreateProcessInput, UpdateProcessInput } from './dto/process.dto';
import { CreateTaskInput, UpdateTaskInput, AssignTaskInput, TaskStatus } from './dto/task.dto';

@Injectable()
export class ProcessService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: createProcessInput.projectId,
        iduser: editorId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para crear procesos en este proyecto');
    }

    const process = await this.prisma.process.create({
      data: {
        name: createProcessInput.name,
        description: createProcessInput.description,
        startdate: createProcessInput.startDate ? new Date(createProcessInput.startDate) : null,
        duedate: createProcessInput.dueDate ? new Date(createProcessInput.dueDate) : null,
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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingProcess.idproject,
        iduser: editorId,
      },
    });
    if (!projectMember) {
      throw new ForbiddenException('No tienes permisos para editar este proceso');
    }

    const process = await this.prisma.process.update({
      where: { id: updateProcessInput.id },
      data: {
        name: updateProcessInput.name,
        description: updateProcessInput.description,
        startdate: updateProcessInput.startDate ? new Date(updateProcessInput.startDate) : null,
        duedate: updateProcessInput.dueDate ? new Date(updateProcessInput.dueDate) : null,
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

    // Validar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingProcess.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
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
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
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
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
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
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
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
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
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

    // Validar que el miembro asignado existe (si se proporciona)
    if (createTaskInput.memberId) {
      const assignedMember = await this.prisma.project_member.findFirst({
        where: {
          idproject: process.idproject,
          iduser: createTaskInput.memberId,
        },
      });
      if (!assignedMember) {
        throw new BadRequestException('El miembro asignado no pertenece al proyecto');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        name: createTaskInput.name,
        description: createTaskInput.description,
        startdate: createTaskInput.startDate ? new Date(createTaskInput.startDate) : null,
        duedateat: createTaskInput.dueDate ? new Date(createTaskInput.dueDate) : null,
        status: createTaskInput.status,
        ideditor: editorId,
        idmember: createTaskInput.memberId,
        idprocess: createTaskInput.processId,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(task);
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

    // Validar que el miembro asignado existe (si se proporciona)
    if (updateTaskInput.memberId) {
      const assignedMember = await this.prisma.project_member.findFirst({
        where: {
          idproject: existingTask.process.idproject,
          iduser: updateTaskInput.memberId,
        },
      });
      if (!assignedMember) {
        throw new BadRequestException('El miembro asignado no pertenece al proyecto');
      }
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
        idmember: updateTaskInput.memberId,
        report: updateTaskInput.report,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(task);
  }

  async updateTaskAsMember(updateTaskInput: { id: string; status?: string; report?: string }, memberId: string): Promise<Task> {
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

    // Solo permitir actualizar status y report
    const updateData: any = {
      editedat: new Date(),
    };

    if (updateTaskInput.status !== undefined) {
      updateData.status = updateTaskInput.status;
    }

    if (updateTaskInput.report !== undefined) {
      updateData.report = updateTaskInput.report;
    }

    const task = await this.prisma.task.update({
      where: { id: updateTaskInput.id },
      data: updateData,
      include: {
        user: true,
        process: true,
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(task);
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

  async assignTask(assignTaskInput: AssignTaskInput, userId: string): Promise<Task> {
    // Validar que la tarea existe
    const existingTask = await this.prisma.task.findUnique({
      where: { id: assignTaskInput.taskId },
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
      throw new ForbiddenException('No tienes permisos para asignar esta tarea');
    }

    // Validar que el miembro asignado existe
    const assignedMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: existingTask.process.idproject,
        iduser: assignTaskInput.memberId,
      },
    });
    if (!assignedMember) {
      throw new BadRequestException('El miembro asignado no pertenece al proyecto');
    }

    const task = await this.prisma.task.update({
      where: { id: assignTaskInput.taskId },
      data: {
        idmember: assignTaskInput.memberId,
        ideditor: userId,
        editedat: new Date(),
      },
      include: {
        user: true,
        process: true,
        project_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
    });

    return this.mapTask(task);
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
      memberId: task.idmember,
      member: task.project_member,
      report: task.report,
      processId: task.idprocess,
      process: task.process,
      createdAt: task.createdat,
      updatedAt: task.updatedat,
    };
  }
}
