import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserService } from '../../auth/user/user.service';
import { Project } from '../entities/project.entity';
import { Category } from '../entities/category.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from '../dto/project.dto';
import { CreateCategoryInput, UpdateCategoryInput } from '../dto/category.dto';
import { CreateProcessInput } from '../../process/dto/process.dto';
import { Process } from '../../process/entities/process.entity';
import { AssignProcessMemberInput, RemoveProcessMemberInput } from '../dto/project-member.dto';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  // ==================== PROJECT METHODS ====================

  async findAllProjects(userId?: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      include: {
        user: true, // editor
        category: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    return projects.map(project => this.mapProject(project));
  }

  async findProjectById(id: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        user: true, // editor
        category: true,
        unit: true,
      },
    });

    if (!project) return null;
    return this.mapProject(project);
  }

  async createProject(createProjectInput: CreateProjectInput, editorId: string): Promise<Project> {
    // Validar que la categoría existe (si se proporciona)
    if (createProjectInput.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: createProjectInput.categoryId },
      });
      if (!category) {
        throw new BadRequestException('La categoría especificada no existe');
      }
    }

    // Validar que la unidad existe (si se proporciona)
    if (createProjectInput.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: createProjectInput.unitId },
      });
      if (!unit) {
        throw new BadRequestException('La unidad especificada no existe');
      }
    }

    // Obtener el rol 'admin' para asignarlo al creador
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'admin' }
    });

    if (!adminRole) {
      throw new BadRequestException('Rol admin no encontrado en el sistema');
    }

    const project = await this.prisma.project.create({
      data: {
        name: createProjectInput.name,
        description: createProjectInput.description,
        startdate: createProjectInput.startDate ? new Date(createProjectInput.startDate) : null,
        duedate: createProjectInput.dueDate ? new Date(createProjectInput.dueDate) : null,
        ideditor: editorId,
        idcategory: createProjectInput.categoryId,
        idunit: createProjectInput.unitId,
        editedat: new Date(),
      },
      include: {
        user: true,
        category: true,
        unit: true,
      },
    });

    // Agregar automáticamente al creador como admin del proyecto
    await this.prisma.project_member.create({
      data: {
        idproject: project.id,
        iduser: editorId,
        idrole: adminRole.id,
      },
    });

    return this.mapProject(project);
  }

  async updateProject(updateProjectInput: UpdateProjectInput, editorId: string): Promise<Project> {
    const existingProject = await this.findProjectById(updateProjectInput.id);
    if (!existingProject) {
      throw new NotFoundException(`Proyecto con ID ${updateProjectInput.id} no encontrado`);
    }

    // Validar que la categoría existe (si se actualiza)
    if (updateProjectInput.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProjectInput.categoryId },
      });
      if (!category) {
        throw new BadRequestException('La categoría especificada no existe');
      }
    }

    const updateData: any = {
      editedat: new Date(),
      ideditor: editorId,
    };

    if (updateProjectInput.name) updateData.name = updateProjectInput.name;
    if (updateProjectInput.description !== undefined) updateData.description = updateProjectInput.description;
    if (updateProjectInput.startDate) updateData.startdate = new Date(updateProjectInput.startDate);
    if (updateProjectInput.dueDate) updateData.duedate = new Date(updateProjectInput.dueDate);
    if (updateProjectInput.categoryId !== undefined) updateData.idcategory = updateProjectInput.categoryId;
    if (updateProjectInput.unitId !== undefined) updateData.idunit = updateProjectInput.unitId;

    const project = await this.prisma.project.update({
      where: { id: updateProjectInput.id },
      data: updateData,
      include: {
        user: true,
        category: true,
        unit: true,
      },
    });

    return this.mapProject(project);
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const project = await this.findProjectById(id);
    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${id} no encontrado`);
    }

    // Verificar que hay miembros o procesos asociados
    const members = await this.prisma.project_member.findMany({
      where: { idproject: id },
    });

    const processes = await this.prisma.process.findMany({
      where: { idproject: id },
    });

    if (members.length > 0 || processes.length > 0) {
      throw new BadRequestException('No se puede eliminar el proyecto porque tiene miembros o procesos asociados');
    }

    await this.prisma.project.delete({
      where: { id },
    });

    return true;
  }

  async findUnitProjects(unitId: number): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { idunit: unitId },
      include: {
        user: true, // editor
        category: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    return projects.map(project => this.mapProject(project));
  }

  async findAreaProjects(areaId: number): Promise<Project[]> {
    // Los proyectos se relacionan con áreas a través de las categorías
    const projects = await this.prisma.project.findMany({
      where: {
        category: {
          id_area: areaId
        }
      },
      include: {
        user: true, // editor
        category: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    return projects.map(project => this.mapProject(project));
  }

  async getProjectProcesses(projectId: string): Promise<any[]> {
    // Obtener procesos del proyecto
    const processes = await this.prisma.process.findMany({
      where: { idproject: projectId },
      include: {
        user: true, // editor
        project: true,
      },
      orderBy: { name: 'asc' },
    });

    return processes.map(process => ({
      id: process.id,
      name: process.name || '',
      description: process.description,
      startDate: process.startdate,
      dueDate: process.duedate,
      editedAt: process.editedat,
      editor: process.user ? {
        id: process.user.id,
        name: process.user.name || '',
        email: process.user.email,
        password: process.user.password || undefined,
        isActive: process.user.isactive ?? true,
        havePassword: process.user.havepassword ?? false,
      } : undefined,
      projectId: process.idproject,
    }));
  }

  async getProjectProcessesByProcessId(processId: string): Promise<any[]> {
    // Obtener el proceso específico y retornar su proyecto asociado
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: {
        user: true, // editor
        project: true,
      },
    });

    if (!process) {
      return [];
    }

    return [{
      id: process.id,
      name: process.name || '',
      description: process.description,
      startDate: process.startdate,
      dueDate: process.duedate,
      editedAt: process.editedat,
      editor: process.user ? {
        id: process.user.id,
        name: process.user.name || '',
        email: process.user.email,
        password: process.user.password || undefined,
        isActive: process.user.isactive ?? true,
        havePassword: process.user.havepassword ?? false,
      } : undefined,
      projectId: process.idproject,
    }];
  }

  async getProjectTasks(projectId: string): Promise<any[]> {
    // Obtener tareas del proyecto a través de los procesos
    const tasks = await this.prisma.task.findMany({
      where: {
        process: {
          idproject: projectId
        }
      },
      include: {
        user: true, // editor
        process: true,
        project_member: {
          include: {
            user: true,
            role: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return tasks.map(task => ({
      id: task.id,
      name: task.name || '',
      description: task.description,
      startDate: task.startdate,
      dueDate: task.duedateat,
      status: task.status,
      editedAt: task.editedat,
      report: task.report,
      editor: task.user ? {
        id: task.user.id,
        name: task.user.name || '',
        email: task.user.email,
        password: task.user.password || undefined,
        isActive: task.user.isactive ?? true,
        havePassword: task.user.havepassword ?? false,
      } : undefined,
      processId: task.idprocess,
      memberId: task.idmember,
      member: task.project_member ? {
        id: task.project_member.id,
        userId: task.project_member.iduser,
        projectId: task.project_member.idproject,
        roleId: task.project_member.idrole,
        user: task.project_member.user ? {
          id: task.project_member.user.id,
          name: task.project_member.user.name || '',
          email: task.project_member.user.email,
          password: task.project_member.user.password || undefined,
          isActive: task.project_member.user.isactive ?? true,
          havePassword: task.project_member.user.havepassword ?? false,
        } : undefined,
        role: task.project_member.role ? {
          id: task.project_member.role.id,
          name: task.project_member.role.name || '',
          description: undefined,
        } : undefined,
      } : undefined,
    }));
  }

  async getProjectMemberById(id: string): Promise<any> {
    const member = await this.prisma.project_member.findUnique({
      where: { id },
      include: {
        user: true,
        role: true,
        project: true,
      },
    });

    if (!member) {
      throw new Error('Project member not found');
    }

    return this.mapProjectMember(member);
  }

  async createProjectProcess(idProject: string, idProcess: string, userId: string): Promise<string> {
    // Verificar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: idProject },
    });
    if (!project) {
      throw new Error('El proyecto especificado no existe');
    }

    // Verificar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id: idProcess },
    });
    if (!process) {
      throw new Error('El proceso especificado no existe');
    }

    // Verificar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: idProject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new Error('No tienes permisos para crear esta asociación');
    }

    // Actualizar el proceso para asociarlo al proyecto
    await this.prisma.process.update({
      where: { id: idProcess },
      data: {
        idproject: idProject,
        ideditor: userId,
        editedat: new Date(),
      },
    });

    return `Proceso ${idProcess} asociado exitosamente al proyecto ${idProject}`;
  }

  async removeProjectProcess(id: string, userId: string): Promise<string> {
    // Verificar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!process) {
      throw new Error('El proceso especificado no existe');
    }

    // Verificar que el usuario es miembro del proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new Error('No tienes permisos para eliminar esta asociación');
    }

    // Eliminar el proceso (esto también elimina la asociación con el proyecto)
    await this.prisma.process.delete({
      where: { id },
    });

    return `Proceso ${id} eliminado exitosamente`;
  }

  // ==================== PROJECT PERMISSIONS METHODS ====================

  async isProjectAdmin(projectId: string, userId: string): Promise<boolean> {
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'admin' }
    });

    if (!adminRole) return false;

    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
        idrole: adminRole.id,
      },
    });

    return !!projectMember;
  }

  // ==================== PROJECT MEMBERS METHODS ====================

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const members = await this.prisma.project_member.findMany({
      where: { idproject: projectId },
      include: {
        user: true,
        role: true,
        project: true,
      },
    });

    return members.map(member => this.mapProjectMember(member));
  }

  async addProjectMember(addMemberInput: AddProjectMemberInput, requestUserId: string): Promise<ProjectMember> {
    // Verificar que el proyecto existe
    const project = await this.findProjectById(addMemberInput.projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Verificar que el usuario solicitante es admin del proyecto
    const isAdmin = await this.isProjectAdmin(addMemberInput.projectId, requestUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores del proyecto pueden agregar miembros');
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: addMemberInput.userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que el rol existe
    const role = await this.prisma.role.findUnique({
      where: { id: addMemberInput.roleId },
    });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Verificar que el usuario no es ya miembro del proyecto
    const existingMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: addMemberInput.projectId,
        iduser: addMemberInput.userId,
      },
    });

    if (existingMember) {
      throw new BadRequestException('El usuario ya es miembro de este proyecto');
    }

    const member = await this.prisma.project_member.create({
      data: {
        idproject: addMemberInput.projectId,
        iduser: addMemberInput.userId,
        idrole: addMemberInput.roleId,
      },
      include: {
        user: true,
        role: true,
        project: true,
      },
    });

    return this.mapProjectMember(member);
  }

  async removeProjectMember(projectId: string, userId: string, requestUserId: string): Promise<boolean> {
    // Verificar que el usuario solicitante es admin del proyecto
    const isAdmin = await this.isProjectAdmin(projectId, requestUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores del proyecto pueden remover miembros');
    }

    const member = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
      },
    });

    if (!member) {
      throw new NotFoundException('Miembro del proyecto no encontrado');
    }

    await this.prisma.project_member.delete({
      where: { id: member.id },
    });

    return true;
  }

  async updateProjectMember(updateProjectMemberInput: { id: string; idRole: number }, requestUserId: string): Promise<ProjectMember> {
    // Verificar que el miembro existe
    const member = await this.prisma.project_member.findUnique({
      where: { id: updateProjectMemberInput.id },
      include: {
        user: true,
        role: true,
        project: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Miembro del proyecto no encontrado');
    }

    // Verificar que el miembro tiene un proyecto asociado
    if (!member.idproject) {
      throw new BadRequestException('El miembro no tiene un proyecto asociado');
    }

    // Verificar que el usuario solicitante es admin del proyecto
    const isAdmin = await this.isProjectAdmin(member.idproject, requestUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores del proyecto pueden actualizar miembros');
    }

    // Verificar que el rol existe
    const role = await this.prisma.role.findUnique({
      where: { id: updateProjectMemberInput.idRole },
    });
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Actualizar el rol del miembro
    const updatedMember = await this.prisma.project_member.update({
      where: { id: updateProjectMemberInput.id },
      data: { idrole: updateProjectMemberInput.idRole },
      include: {
        user: true,
        role: true,
        project: true,
      },
    });

    return this.mapProjectMember(updatedMember);
  }

  // ==================== HELPER METHODS ====================

  private mapProject(project: any): Project {
    return {
      id: project.id,
      name: project.name || '',
      description: project.description,
      startDate: project.startdate,
      dueDate: project.duedate,
      editedAt: project.editedat,
      editor: project.user ? {
        id: project.user.id,
        name: project.user.name || '',
        email: project.user.email,
        password: project.user.password || undefined,
        isActive: project.user.isactive ?? true,
        havePassword: project.user.havepassword ?? false,
      } : undefined,
      categoryId: project.idcategory,
      unitId: project.idunit,
    };
  }

  private mapProjectMember(member: any): ProjectMember {
    return {
      id: member.id,
      userId: member.iduser,
      projectId: member.idproject,
      roleId: member.idrole,
      user: member.user ? {
        id: member.user.id,
        name: member.user.name || '',
        email: member.user.email,
        password: member.user.password || undefined,
        isActive: member.user.isactive ?? true,
        havePassword: member.user.havepassword ?? false,
      } : undefined,
      role: member.role ? {
        id: member.role.id,
        name: member.role.name || '',
        description: undefined,
      } : undefined,
      project: member.project ? this.mapProject(member.project) : undefined,
    };
  }

  // ==================== PROJECT_MEMBER METHODS ====================

  async createProcessAsProjectMember(createProcessInput: CreateProcessInput, projectMemberId: string): Promise<Process> {
    // Validar que el proyecto existe
    const project = await this.prisma.project.findUnique({
      where: { id: createProcessInput.projectId },
    });
    if (!project) {
      throw new BadRequestException('El proyecto especificado no existe');
    }

    // Validar que el usuario es project_member de este proyecto
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, createProcessInput.projectId);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para crear procesos en este proyecto');
    }

    const process = await this.prisma.process.create({
      data: {
        name: createProcessInput.name,
        description: createProcessInput.description,
        startdate: createProcessInput.startDate ? new Date(createProcessInput.startDate) : null,
        duedate: createProcessInput.dueDate ? new Date(createProcessInput.dueDate) : null,
        ideditor: projectMemberId,
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

  async updateProcessAsProjectMember(processId: string, updateData: Partial<CreateProcessInput>, projectMemberId: string): Promise<Process> {
    // Validar que el proceso existe
    const existingProcess = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });
    if (!existingProcess) {
      throw new NotFoundException('Proceso no encontrado');
    }

    // Validar que el usuario es project_member del proyecto
    if (!existingProcess.idproject) {
      throw new BadRequestException('El proceso no tiene un proyecto asociado');
    }
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, existingProcess.idproject);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para editar procesos en este proyecto');
    }

    const process = await this.prisma.process.update({
      where: { id: processId },
      data: {
        name: updateData.name,
        description: updateData.description,
        startdate: updateData.startDate ? new Date(updateData.startDate) : null,
        duedate: updateData.dueDate ? new Date(updateData.dueDate) : null,
        ideditor: projectMemberId,
        editedat: new Date(),
      },
      include: {
        user: true,
        project: true,
      },
    });

    return this.mapProcess(process);
  }

  async assignProcessMember(processId: string, userId: string, roleId: number, projectMemberId: string): Promise<boolean> {
    // Validar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });
    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Validar que el usuario es project_member del proyecto
    if (!process.idproject) {
      throw new BadRequestException('El proceso no tiene un proyecto asociado');
    }
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, process.idproject);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para asignar miembros a procesos en este proyecto');
    }

    // Validar que el usuario a asignar pertenece al proyecto
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: process.idproject,
        iduser: userId,
      },
    });
    if (!projectMember) {
      throw new BadRequestException('El usuario no pertenece al proyecto');
    }

    // Verificar que no esté ya asignado
    const existingProcessMember = await this.prisma.process_member.findFirst({
      where: {
        idprocess: processId,
        iduser: userId,
      },
    });
    if (existingProcessMember) {
      throw new BadRequestException('El usuario ya está asignado a este proceso');
    }

    // Crear la asignación
    await this.prisma.process_member.create({
      data: {
        idprocess: processId,
        iduser: userId,
        idrole: roleId,
        assigned_at: new Date(),
      },
    });

    return true;
  }

  async removeProcessMember(processId: string, userId: string, projectMemberId: string): Promise<boolean> {
    // Validar que el proceso existe
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { project: true },
    });
    if (!process) {
      throw new BadRequestException('El proceso especificado no existe');
    }

    // Validar que el usuario es project_member del proyecto
    if (!process.idproject) {
      throw new BadRequestException('El proceso no tiene un proyecto asociado');
    }
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, process.idproject);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para remover miembros de procesos en este proyecto');
    }

    // Verificar que el process_member existe
    const processMember = await this.prisma.process_member.findFirst({
      where: {
        idprocess: processId,
        iduser: userId,
      },
    });
    if (!processMember) {
      throw new BadRequestException('El usuario no está asignado a este proceso');
    }

    // Remover la asignación
    await this.prisma.process_member.delete({
      where: { id: processMember.id },
    });

    return true;
  }

  async getProjectProcessesAsMember(projectId: string, projectMemberId: string): Promise<Process[]> {
    // Validar que el usuario es project_member del proyecto
    const isProjectMember = await this.userService.isProjectMember(projectMemberId, projectId);
    if (!isProjectMember) {
      throw new ForbiddenException('No tienes permisos para ver los procesos de este proyecto');
    }

    const processes = await this.prisma.process.findMany({
      where: { idproject: projectId },
      include: {
        user: true,
        project: true,
        task: {
          include: {
            user: true,
            project_member: {
              include: {
                user: true,
                role: true,
              },
            },
            task_member: {
              include: {
                user: true,
                role: true,
              },
            },
          },
        },
        process_member: {
          include: {
            user: true,
            role: true,
          },
        },
      },
      orderBy: { editedat: 'desc' },
    });

    return processes.map(process => this.mapProcess(process));
  }

  // ==================== HELPER METHODS ====================

  private mapProcess(process: any): Process {
    return {
      id: process.id,
      name: process.name || '',
      description: process.description || '',
      startDate: process.startdate,
      dueDate: process.duedate,
      editedAt: process.editedat,
      projectId: process.idproject,
      editor: process.user ? {
        id: process.user.id,
        name: process.user.name || '',
        email: process.user.email,
        password: process.user.password || undefined,
        isActive: process.user.isactive ?? true,
        havePassword: process.user.havepassword ?? false,
      } : undefined,
      project: process.project ? this.mapProject(process.project) : undefined,
    };
  }
}
