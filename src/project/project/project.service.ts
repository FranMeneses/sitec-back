import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Project } from '../entities/project.entity';
import { Category } from '../entities/category.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from '../dto/project.dto';
import { CreateCategoryInput, UpdateCategoryInput } from '../dto/category.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

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
}
