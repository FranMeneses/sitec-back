import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User } from '../entities/user.entity';
import { SystemRoleService } from '../system-role/system-role.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private systemRoleService: SystemRoleService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    };
  }

  async findByIdWithRoles(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        system_role: {
          include: {
            role: true
          }
        },
        unit_member: {
          include: {
            role: true
          }
        },
        project_member: {
          include: {
            role: true
          }
        },
        task_member: {
          include: {
            role: true
          }
        },
        admin: true
      }
    });
    
    if (!user) return null;
    
    // Recopilar todos los roles del usuario
    const allRoles: any[] = [];
    
    // Agregar system_role si existe
    if (user.system_role?.role) {
      allRoles.push(user.system_role.role);
    }
    
    // Agregar roles de unit_member
    user.unit_member.forEach(um => {
      if (um.role) allRoles.push(um.role);
    });
    
    // Agregar roles de project_member
    user.project_member.forEach(pm => {
      if (pm.role) allRoles.push(pm.role);
    });
    
    // Ya no usamos process_member
    
    // Agregar roles de task_member
    user.task_member.forEach(tm => {
      if (tm.role) allRoles.push(tm.role);
    });
    
    // Eliminar duplicados basado en ID
    const uniqueRoles = allRoles.filter((role, index, self) => 
      index === self.findIndex(r => r.id === role.id)
    );
    
    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
      systemRole: user.system_role ? {
        id: user.system_role.id,
        userId: user.system_role.user_id,
        roleId: user.system_role.role_id,
        createdAt: user.system_role.created_at,
        role: user.system_role.role
      } : null,
      roles: uniqueRoles, // Todos los roles del usuario
      admin: user.admin.length > 0 ? user.admin[0] : null
    };
  }

  async createUser(data: {
    name: string;
    email: string;
    password?: string;
    havePassword?: boolean;
    idRole?: string;
    idArea?: string;
  }): Promise<User> {
    const hashedPassword = data.password 
      ? await bcrypt.hash(data.password, 12)
      : null;

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        havepassword: !!data.password,
        isactive: true,
      },
    });

    // Asignar automáticamente el rol "user" al usuario
    try {
      await this.systemRoleService.assignDefaultRole(user.id);
    } catch (error) {
      // Si falla la asignación del rol, eliminar el usuario creado
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new Error(`Error al crear usuario: ${error.message}`);
    }

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    };
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.isActive !== undefined) updateData.isactive = data.isActive;
    
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.havepassword = true;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    };
  }

  async removeUser(id: string): Promise<User> {
    // Soft delete: marcar como inactivo en lugar de eliminar físicamente
    const user = await this.prisma.user.update({
      where: { id },
      data: { isactive: false }
    });

    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    };
  }

  async createSuperAdmin(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    // Verificar que no exista otro super_admin
    const existingSuperAdmin = await this.prisma.system_role.findFirst({
      where: {
        role: { name: 'super_admin' }
      }
    });

    if (existingSuperAdmin) {
      throw new Error('Ya existe un super_admin en el sistema');
    }

    // Crear el usuario
    const user = await this.createUser({
      name: data.name,
      email: data.email,
      password: data.password,
      havePassword: true,
    });

    // Asignar rol super_admin
    const superAdminRole = await this.prisma.role.findFirst({
      where: { name: 'super_admin' }
    });

    if (!superAdminRole) {
      throw new Error('Rol super_admin no encontrado');
    }

    // Actualizar el system_role del usuario a super_admin
    await this.systemRoleService.updateUserSystemRole(user.id, superAdminRole.id);

    return user;
  }

  async checkSuperAdminExists(): Promise<boolean> {
    const existingSuperAdmin = await this.prisma.system_role.findFirst({
      where: {
        role: { name: 'super_admin' }
      }
    });

    return !!existingSuperAdmin;
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async isValidUCNEmail(email: string): Promise<boolean> {
    const validDomains = ['@alumnos.ucn.cl', '@ce.ucn.cl', '@ucn.cl'];
    return validDomains.some(domain => email.endsWith(domain));
  }

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    // Verificar en unit_member
    const unitMember = await this.prisma.unit_member.findFirst({
      where: { 
        iduser: userId,
        role: { name: roleName }
      },
      include: { role: true }
    });

    if (unitMember) return true;

    // Verificar en project_member
    const projectMember = await this.prisma.project_member.findFirst({
      where: { 
        iduser: userId,
        role: { name: roleName }
      },
      include: { role: true }
    });

    return !!projectMember;
  }

  async isAdmin(userId: string): Promise<boolean> {
    // Verificar si el usuario es admin de alguna área
    const adminRecord = await this.prisma.admin.findFirst({
      where: { iduser: userId }
    });

    return !!adminRecord;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    // Verificar si el usuario es super_admin
    const systemRole = await this.prisma.system_role.findFirst({
      where: { 
        user_id: userId,
        role: { name: 'super_admin' }
      },
      include: { role: true }
    });

    return !!systemRole;
  }

  async getAdminArea(userId: string): Promise<number | null> {
    // Obtener el área del admin
    const adminRecord = await this.prisma.admin.findFirst({
      where: { iduser: userId },
      select: { idarea: true }
    });

    return adminRecord?.idarea || null;
  }

  async initializeDefaultRoles(): Promise<void> {
    const defaultRoles = [
      'super_admin',
      'admin',
      'area_member',
      'unit_member',
      'project_member',
      'task_member',
      'user'
    ];

    for (const roleName of defaultRoles) {
      const existingRole = await this.prisma.role.findFirst({
        where: { name: roleName }
      });

      if (!existingRole) {
        await this.prisma.role.create({
          data: { name: roleName }
        });
      }
    }
  }

  async findUsersProject(idUser: string): Promise<any[]> {
    // Obtener proyectos donde el usuario es miembro
    const projectMembers = await this.prisma.project_member.findMany({
      where: { iduser: idUser },
      include: {
        project: {
          include: {
            unit: true,
            category: true,
            user: true // editor del proyecto
          }
        }
      }
    });

    // Obtener proyectos donde el usuario es editor
    const editedProjects = await this.prisma.project.findMany({
      where: { ideditor: idUser },
      include: {
        unit: true,
        category: true,
        user: true // editor del proyecto
      }
    });

    // Combinar y eliminar duplicados
    const allProjects = [
      ...projectMembers.map(pm => pm.project).filter(Boolean), 
      ...editedProjects
    ];
    const uniqueProjects = allProjects.filter((project, index, self) => 
      project && index === self.findIndex(p => p && p.id === project.id)
    );

    return uniqueProjects;
  }

  async findAllUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { isactive: true }, // Solo usuarios activos
      orderBy: { name: 'asc' }
    });

    return users.map(user => ({
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
    }));
  }


  // ==================== TASK_MEMBER METHODS ====================

  async findUserAssignedTasks(userId: string): Promise<any[]> {
    // Obtener todas las tareas donde el usuario es task_member
    const taskMembers = await this.prisma.task_member.findMany({
      where: { iduser: userId },
      include: {
        task: {
          include: {
            process: {
              include: {
                project: {
                  include: {
                    unit: true,
                    category: true,
                  }
                }
              }
            },
            user: true, // editor
            comment: {
              include: {
                user: true,
              },
              orderBy: { created_at: 'desc' }
            },
            evidence: {
              include: {
                user: true, // uploader
              },
              orderBy: { uploadedat: 'desc' }
            },
            task_member: {
              include: {
                user: true,
                role: true,
              }
            }
          }
        },
        role: true,
      },
      orderBy: { assigned_at: 'desc' }
    });

    return taskMembers.map(tm => ({
      id: tm.id,
      assignedAt: tm.assigned_at,
      role: tm.role,
      task: tm.task,
    }));
  }

  async isTaskMember(userId: string, taskId: string): Promise<boolean> {
    const taskMember = await this.prisma.task_member.findFirst({
      where: {
        iduser: userId,
        idtask: taskId,
      },
    });

    return !!taskMember;
  }

  async canEditTask(userId: string, taskId: string): Promise<boolean> {
    // Un task_member puede editar solo el reporte y estado de sus tareas asignadas
    return await this.isTaskMember(userId, taskId);
  }

  async canAddCommentToTask(userId: string, taskId: string): Promise<boolean> {
    // Un task_member puede agregar comentarios a sus tareas asignadas
    return await this.isTaskMember(userId, taskId);
  }

  async canAddEvidenceToTask(userId: string, taskId: string): Promise<boolean> {
    // Un task_member puede agregar evidencias a sus tareas asignadas
    return await this.isTaskMember(userId, taskId);
  }



  // ==================== PROJECT_MEMBER METHODS ====================

  async findUserProjectMemberships(userId: string): Promise<any[]> {
    // Obtener todos los proyectos donde el usuario es project_member
    const projectMembers = await this.prisma.project_member.findMany({
      where: { iduser: userId },
      include: {
        project: {
          include: {
            unit: true,
            category: true,
            user: true, // editor del proyecto
            process: {
              include: {
                user: true, // editor del proceso
                task: {
                  include: {
                    user: true, // editor de la tarea
                    task_member: {
                      include: {
                        user: true,
                        role: true,
                      }
                    }
                  }
                }
              }
            }
          }
        },
        role: true,
      },
      orderBy: { id: 'desc' }
    });

    return projectMembers.map(pm => ({
      id: pm.id,
      assignedAt: null, // project_member no tiene assigned_at en el esquema
      role: pm.role || null,
      project: pm.project || null,
    }));
  }

  async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        iduser: userId,
        idproject: projectId,
      },
    });

    return !!projectMember;
  }

  async canCreateProcessInProject(userId: string, projectId: string): Promise<boolean> {
    // Un project_member puede crear procesos en sus proyectos asignados
    return await this.isProjectMember(userId, projectId);
  }

  async canViewAllProcessesInProject(userId: string, projectId: string): Promise<boolean> {
    // Un project_member puede ver todos los procesos de sus proyectos asignados
    return await this.isProjectMember(userId, projectId);
  }

  async canEditProcessInProject(userId: string, projectId: string): Promise<boolean> {
    // Un project_member puede editar procesos de sus proyectos asignados
    return await this.isProjectMember(userId, projectId);
  }

  async canAssignProcessMembers(userId: string, projectId: string): Promise<boolean> {
    // Un project_member puede asignar miembros a procesos de sus proyectos
    return await this.isProjectMember(userId, projectId);
  }

  async canRemoveProcessMembers(userId: string, projectId: string): Promise<boolean> {
    // Un project_member puede remover miembros de procesos de sus proyectos
    return await this.isProjectMember(userId, projectId);
  }

  // ==================== UNIT_MEMBER METHODS ====================

  async findUserUnitMemberships(userId: string): Promise<any[]> {
    // Obtener todas las unidades donde el usuario es unit_member
    const unitMembers = await this.prisma.unit_member.findMany({
      where: { iduser: userId },
      include: {
        unit: {
          include: {
            type: true,
            project: {
              include: {
                category: true,
                user: true, // editor del proyecto
                process: {
                  include: {
                    user: true, // editor del proceso
                    task: {
                      include: {
                        user: true, // editor de la tarea
                        task_member: {
                          include: {
                            user: true,
                            role: true,
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        role: true,
      },
      orderBy: { id: 'desc' }
    });

    return unitMembers.map(um => ({
      id: um.id,
      assignedAt: null, // unit_member no tiene assigned_at en el esquema
      role: um.role || null,
      unit: um.unit || null,
    }));
  }

  async isUnitMember(userId: string, unitId: number): Promise<boolean> {
    const unitMember = await this.prisma.unit_member.findFirst({
      where: {
        iduser: userId,
        idunit: unitId,
      },
    });

    return !!unitMember;
  }

  async canViewAllProjectsInUnit(userId: string, unitId: number): Promise<boolean> {
    // Un unit_member puede ver todos los proyectos de su unidad
    return await this.isUnitMember(userId, unitId);
  }

  async canCreateProjectInUnit(userId: string, unitId: number): Promise<boolean> {
    // Un unit_member puede crear proyectos en su unidad
    return await this.isUnitMember(userId, unitId);
  }

  async canEditProjectInUnit(userId: string, unitId: number): Promise<boolean> {
    // Un unit_member puede editar proyectos de su unidad
    return await this.isUnitMember(userId, unitId);
  }

  async canAssignProjectMembers(userId: string, unitId: number): Promise<boolean> {
    // Un unit_member puede asignar miembros a proyectos de su unidad
    return await this.isUnitMember(userId, unitId);
  }

  async canRemoveProjectMembers(userId: string, unitId: number): Promise<boolean> {
    // Un unit_member puede remover miembros de proyectos de su unidad
    return await this.isUnitMember(userId, unitId);
  }

  async canViewAllCategories(userId: string): Promise<boolean> {
    // Super admin puede ver todas las categorías
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin puede ver todas las categorías
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) return true;

    // Un unit_member puede ver todas las categorías
    return await this.hasUnitMembership(userId);
  }

  async canCreateCategory(userId: string): Promise<boolean> {
    // Super admin puede crear categorías
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin puede crear categorías en su área
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) return true;

    // Un unit_member puede crear categorías
    return await this.hasUnitMembership(userId);
  }

  async canEditCategory(userId: string): Promise<boolean> {
    // Super admin puede editar categorías
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin puede editar categorías en su área
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) return true;

    // Un unit_member puede editar categorías
    return await this.hasUnitMembership(userId);
  }

  private async hasUnitMembership(userId: string): Promise<boolean> {
    const unitMember = await this.prisma.unit_member.findFirst({
      where: { iduser: userId },
    });

    return !!unitMember;
  }

  // ==================== SUPER ADMIN METHODS ====================

  async canSuperAdminPerformAction(userId: string, resourceId: string, action: string, resourceType: string): Promise<boolean> {
    // Super admin puede realizar cualquier acción en cualquier recurso
    const isSuperAdmin = await this.isSuperAdmin(userId);
    return isSuperAdmin;
  }

  // ==================== ADMIN INHERITANCE METHODS ====================

  async canAdminPerformTaskAction(userId: string, taskId: string, action: string): Promise<boolean> {
    // Verificar si es admin
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) return false;

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(userId);
    if (!adminArea) return false;

    // Verificar que la tarea pertenece a un proyecto con categoría del área del admin
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: {
          include: {
            project: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!task || !task.process.project || !task.process.project.category) return false;
    
    return task.process.project.category.id_area === adminArea;
  }

  async canAdminPerformProcessAction(userId: string, processId: string, action: string): Promise<boolean> {
    // Verificar si es admin
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) return false;

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(userId);
    if (!adminArea) return false;

    // Verificar que el proceso pertenece a un proyecto con categoría del área del admin
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: {
        project: {
          include: {
            category: true
          }
        }
      }
    });

    if (!process || !process.project || !process.project.category) return false;
    
    return process.project.category.id_area === adminArea;
  }

  async canAdminPerformProjectAction(userId: string, projectId: string, action: string): Promise<boolean> {
    // Verificar si es admin
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) return false;

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(userId);
    if (!adminArea) return false;

    // Verificar que el proyecto tiene categoría del área del admin
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        category: true
      }
    });

    if (!project || !project.category) return false;
    
    return project.category.id_area === adminArea;
  }

  async canAdminPerformUnitAction(userId: string, unitId: number, action: string): Promise<boolean> {
    // Verificar si es admin
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) return false;

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(userId);
    if (!adminArea) return false;

    // Verificar que la unidad tiene proyectos con categorías del área del admin
    // o que el admin es unit_member de esa unidad
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        project: {
          include: {
            category: true
          }
        },
        unit_member: {
          where: { iduser: userId }
        }
      }
    });

    if (!unit) return false;

    // Si es unit_member de la unidad, puede realizar acciones
    if (unit.unit_member.length > 0) return true;

    // Si la unidad tiene proyectos con categorías del área del admin, puede realizar acciones
    return unit.project.some(project => 
      project.category && project.category.id_area === adminArea
    );
  }

  // ==================== HIERARCHICAL PERMISSION METHODS ====================

  async canPerformTaskAction(userId: string, taskId: string, action: string): Promise<boolean> {
    // Verificar si es super_admin (tiene todos los permisos)
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Verificar si es admin y puede realizar la acción en su área
    const canAdminPerform = await this.canAdminPerformTaskAction(userId, taskId, action);
    if (canAdminPerform) return true;

    // Verificar si es task_member de la tarea específica
    const isTaskMember = await this.isTaskMember(userId, taskId);
    if (isTaskMember) return true;

    // Verificar si es process_member del proceso de la tarea
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { idprocess: true }
    });
    // Ya no verificamos process_member, solo project_member

    // Verificar si es project_member del proyecto de la tarea
    if (task) {
      const process = await this.prisma.process.findUnique({
        where: { id: task.idprocess },
        select: { idproject: true }
      });
      if (process && process.idproject) {
        const isProjectMember = await this.isProjectMember(userId, process.idproject);
        if (isProjectMember) return true;
      }
    }

    // Verificar si es unit_member de la unidad del proyecto de la tarea
    if (task) {
      const process = await this.prisma.process.findUnique({
        where: { id: task.idprocess },
        select: { idproject: true }
      });
      if (process && process.idproject) {
        const project = await this.prisma.project.findUnique({
          where: { id: process.idproject },
          select: { idunit: true }
        });
        if (project && project.idunit) {
          const isUnitMember = await this.isUnitMember(userId, project.idunit);
          if (isUnitMember) return true;
        }
      }
    }

    // Verificar si es area_member (auditor) del área del proyecto de la tarea
    const canAreaMemberPerform = await this.canAreaMemberPerformTaskAction(userId, taskId, action);
    if (canAreaMemberPerform) return true;

    return false;
  }

  async canPerformProcessAction(userId: string, processId: string, action: string): Promise<boolean> {
    // Verificar si es super_admin (tiene todos los permisos)
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Verificar si es admin y puede realizar la acción en su área
    const canAdminPerform = await this.canAdminPerformProcessAction(userId, processId, action);
    if (canAdminPerform) return true;

    // Ya no verificamos process_member, solo project_member

    // Verificar si es project_member del proyecto del proceso
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { idproject: true }
    });
    if (process && process.idproject) {
      const isProjectMember = await this.isProjectMember(userId, process.idproject);
      if (isProjectMember) return true;
    }

    // Verificar si es unit_member de la unidad del proyecto del proceso
    if (process && process.idproject) {
      const project = await this.prisma.project.findUnique({
        where: { id: process.idproject },
        select: { idunit: true }
      });
      if (project && project.idunit) {
        const isUnitMember = await this.isUnitMember(userId, project.idunit);
        if (isUnitMember) return true;
      }
    }

    return false;
  }

  async canPerformProjectAction(userId: string, projectId: string, action: string): Promise<boolean> {
    // Verificar si es super_admin (tiene todos los permisos)
    const isSuperAdmin = await this.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Verificar si es admin y puede realizar la acción en su área
    const canAdminPerform = await this.canAdminPerformProjectAction(userId, projectId, action);
    if (canAdminPerform) return true;

    // Verificar si es project_member del proyecto específico
    const isProjectMember = await this.isProjectMember(userId, projectId);
    if (isProjectMember) return true;

    // Verificar si es unit_member de la unidad del proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { idunit: true }
    });
    if (project && project.idunit) {
      const isUnitMember = await this.isUnitMember(userId, project.idunit);
      if (isUnitMember) return true;
    }

    return false;
  }

  // ==================== AREA_MEMBER (AUDITOR) METHODS ====================

  async isAreaMember(userId: string, areaId: number): Promise<boolean> {
    const areaMember = await this.prisma.area_member.findFirst({
      where: {
        iduser: userId,
        idarea: areaId,
      },
    });
    return !!areaMember;
  }

  async isAreaMemberOfAny(userId: string): Promise<boolean> {
    const areaMember = await this.prisma.area_member.findFirst({
      where: {
        iduser: userId,
      },
    });
    return !!areaMember;
  }

  async getAreaMemberArea(userId: string): Promise<number | null> {
    const areaMember = await this.prisma.area_member.findFirst({
      where: {
        iduser: userId,
      },
      select: {
        idarea: true,
      },
    });
    return areaMember?.idarea || null;
  }

  async canAreaMemberPerformProjectAction(userId: string, projectId: string, action: string): Promise<boolean> {
    // Verificar si es area_member
    const isAreaMember = await this.isAreaMember(userId, 0); // Se verificará el área específica después
    if (!isAreaMember) return false;

    // Obtener el área del area_member
    const auditorArea = await this.getAreaMemberArea(userId);
    if (!auditorArea) return false;

    // Verificar que el proyecto pertenece al área del auditor
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        category: true,
      },
    });

    if (!project || !project.category) return false;
    
    return project.category.id_area === auditorArea;
  }

  async canAreaMemberPerformTaskAction(userId: string, taskId: string, action: string): Promise<boolean> {
    // Verificar si es area_member
    const isAreaMember = await this.isAreaMember(userId, 0); // Se verificará el área específica después
    if (!isAreaMember) return false;

    // Obtener el área del area_member
    const auditorArea = await this.getAreaMemberArea(userId);
    if (!auditorArea) return false;

    // Verificar que la tarea pertenece a un proyecto del área del auditor
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        process: {
          include: {
            project: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!task || !task.process || !task.process.project || !task.process.project.category) return false;
    
    return task.process.project.category.id_area === auditorArea;
  }

  async canAreaMemberReactivateTask(userId: string, taskId: string): Promise<boolean> {
    // Verificar permisos básicos de area_member
    const canPerformAction = await this.canAreaMemberPerformTaskAction(userId, taskId, 'reactivate');
    if (!canPerformAction) return false;

    // Verificar que la tarea está en un estado que permite reactivación
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });

    if (!task) return false;

    // Solo se pueden reactivar tareas canceladas o completadas
    return ['cancelled', 'completed'].includes(task.status || '');
  }

}
