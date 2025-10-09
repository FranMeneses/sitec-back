import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserService } from '../../auth/user/user.service';
import { ProcessService } from '../../process/process.service';
import { Project } from '../entities/project.entity';
import { Category } from '../entities/category.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { User } from '../../auth/entities/user.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from '../dto/project.dto';
import { CreateCategoryInput, UpdateCategoryInput } from '../dto/category.dto';
import { CreateProcessInput } from '../../process/dto/process.dto';
import { Process } from '../../process/entities/process.entity';
import { AssignProcessMemberInput, RemoveProcessMemberInput } from '../dto/project-member.dto';

@Injectable()
export class ProjectService {
  private readonly EXCLUDE_ARCHIVED = { archived_at: null };

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private processService: ProcessService,
  ) { }

  // ==================== VALIDATION METHODS ====================

  private async validateProjectMemberAdditionPermissions(userId: string, projectId: string): Promise<void> {
    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    switch (currentRole) {
      case 'super_admin':
        // Super_admin puede agregar miembros a cualquier proyecto
        return;

      case 'admin':
        // Admin puede agregar miembros solo a proyectos de su área
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
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });

        if (!adminArea) {
          throw new ForbiddenException('Admin no asociado a ningún área');
        }

        if (project.category.id_area !== adminArea.idarea) {
          throw new ForbiddenException('Solo puedes agregar miembros a proyectos de tu área');
        }
        return;

      case 'area_member':
        // Area_member puede agregar miembros a proyectos de las áreas donde es miembro
        const projectForAreaMember = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: {
            category: {
              include: {
                area: true
              }
            }
          }
        });

        if (!projectForAreaMember || !projectForAreaMember.category) {
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const isAreaMember = await this.prisma.area_member.findFirst({
          where: {
            iduser: userId,
            idarea: projectForAreaMember.category.id_area
          }
        });

        if (!isAreaMember) {
          throw new ForbiddenException('Solo puedes agregar miembros a proyectos de áreas donde eres miembro');
        }
        return;

      case 'project_member':
        // Project_member puede agregar miembros solo a proyectos donde es miembro
        const isProjectMember = await this.prisma.project_member.findFirst({
          where: {
            iduser: userId,
            idproject: projectId
          }
        });

        if (!isProjectMember) {
          throw new ForbiddenException('Solo puedes agregar miembros a proyectos donde eres miembro');
        }
        return;

      case 'unit_member':
      case 'task_member':
      case 'user':
      default:
        // Ningún otro rol puede agregar miembros a proyectos
        throw new ForbiddenException('No tiene permisos para agregar miembros a proyectos, por favor contacte con un administrador');
    }
  }

  private async applyRoleHierarchyForProjectMember(userId: string): Promise<void> {
    // Obtener el system_role actual del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    // Si el usuario ya tiene un rol superior, mantenerlo
    if (currentRole === 'super_admin' || 
        currentRole === 'area_role' || 
        currentRole === 'unit_role') {
      // Mantener el system_role actual, solo agregar a project_member
      return;
    }

    // Si el usuario tiene rol "user", actualizarlo a "unit_role" ya que ahora puede gestionar proyectos
    if (currentRole === 'user') {
      const unitRole = await this.prisma.role.findFirst({
        where: { name: 'unit_role' }
      });

      if (unitRole) {
        await this.prisma.system_role.upsert({
          where: { user_id: userId },
          update: { role_id: unitRole.id },
          create: { user_id: userId, role_id: unitRole.id }
        });
      }
    }
  }

  private async validateProjectUpdatePermissions(userId: string, projectId: string): Promise<void> {
    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    switch (currentRole) {
      case 'super_admin':
        // Super_admin puede actualizar cualquier proyecto
        return;

      case 'admin':
        // Admin puede actualizar proyectos de su área
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
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });

        if (!adminArea) {
          throw new ForbiddenException('Admin no asociado a ningún área');
        }

        if (project.category.id_area !== adminArea.idarea) {
          throw new ForbiddenException('Solo puedes actualizar proyectos de tu área');
        }
        return;

      case 'area_member':
        // Area_member puede actualizar proyectos de las áreas donde es miembro
        const projectForAreaMember = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: {
            category: {
              include: {
                area: true
              }
            }
          }
        });

        if (!projectForAreaMember || !projectForAreaMember.category) {
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const isAreaMember = await this.prisma.area_member.findFirst({
          where: {
            iduser: userId,
            idarea: projectForAreaMember.category.id_area
          }
        });

        if (!isAreaMember) {
          throw new ForbiddenException('Solo puedes actualizar proyectos de áreas donde eres miembro');
        }
        return;

      case 'project_member':
        // Project_member puede actualizar proyectos donde es miembro
        const isProjectMember = await this.prisma.project_member.findFirst({
          where: {
            iduser: userId,
            idproject: projectId
          }
        });

        if (!isProjectMember) {
          throw new ForbiddenException('Solo puedes actualizar proyectos donde eres miembro');
        }
        return;

      case 'unit_member':
      case 'task_member':
      case 'user':
      default:
        // Ningún otro rol puede actualizar proyectos
        throw new ForbiddenException('No tiene permisos para actualizar proyectos, por favor contacte con un administrador');
    }
  }

  private async validateProjectDeletePermissions(userId: string, projectId: string): Promise<void> {
    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    switch (currentRole) {
      case 'super_admin':
        // Super_admin puede eliminar cualquier proyecto
        return;

      case 'admin':
        // Admin puede eliminar proyectos de su área
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
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });

        if (!adminArea) {
          throw new ForbiddenException('Admin no asociado a ningún área');
        }

        if (project.category.id_area !== adminArea.idarea) {
          throw new ForbiddenException('Solo puedes eliminar proyectos de tu área');
        }
        return;

      case 'area_member':
        // Area_member puede eliminar proyectos de las áreas donde es miembro
        const projectForAreaMember = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: {
            category: {
              include: {
                area: true
              }
            }
          }
        });

        if (!projectForAreaMember || !projectForAreaMember.category) {
          throw new BadRequestException('Proyecto o categoría no encontrada');
        }

        const isAreaMember = await this.prisma.area_member.findFirst({
          where: {
            iduser: userId,
            idarea: projectForAreaMember.category.id_area
          }
        });

        if (!isAreaMember) {
          throw new ForbiddenException('Solo puedes eliminar proyectos de áreas donde eres miembro');
        }
        return;

      case 'project_member':
        // Project_member NO puede eliminar proyectos
        throw new ForbiddenException('No tienes permisos para eliminar proyectos, por favor contacte con un administrador');

      case 'unit_member':
      case 'task_member':
      case 'user':
      default:
        // Ningún otro rol puede eliminar proyectos
        throw new ForbiddenException('No tiene permisos para eliminar proyectos, por favor contacte con un administrador');
    }
  }

  private async validateProjectCreationPermissions(userId: string, categoryId?: string): Promise<void> {
    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    switch (currentRole) {
      case 'super_admin':
        // Super_admin puede crear proyectos en cualquier área
        return;

      case 'area_role':
        // area_role puede crear proyectos en sus áreas asignadas
        if (!categoryId) {
          throw new ForbiddenException('Debe especificar una categoría para crear el proyecto');
        }

        const category = await this.prisma.category.findUnique({
          where: { id: categoryId },
          select: { id_area: true }
        });

        if (!category) {
          throw new BadRequestException('La categoría especificada no existe');
        }

        // Verificar si es admin (tiene membresía admin)
        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });

        if (adminArea) {
          // Es admin, verificar que está creando en su área
          if (category.id_area !== adminArea.idarea) {
            throw new ForbiddenException('Solo puedes crear proyectos en categorías de tu área');
          }
        } else {
          // No es admin, verificar si es area_member
          const isAreaMember = await this.prisma.area_member.findFirst({
            where: {
              iduser: userId,
              idarea: category.id_area
            }
          });

          if (!isAreaMember) {
            throw new ForbiddenException('Solo puedes crear proyectos en categorías de áreas donde eres miembro');
          }
        }
        return;

      case 'unit_role':
        // unit_role puede crear proyectos en sus unidades asignadas
        if (!categoryId) {
          throw new ForbiddenException('Debe especificar una categoría para crear el proyecto');
        }

        const categoryForUnit = await this.prisma.category.findUnique({
          where: { id: categoryId },
          select: { id_area: true }
        });

        if (!categoryForUnit) {
          throw new BadRequestException('La categoría especificada no existe');
        }

        // Verificar si es unit_member de alguna unidad
        const unitMemberships = await this.prisma.unit_member.findMany({
          where: { iduser: userId },
          select: { idunit: true }
        });

        if (unitMemberships.length === 0) {
          throw new ForbiddenException('No tienes unidades asignadas para crear proyectos');
        }

        // Para unit_role, pueden crear proyectos en cualquier categoría
        // ya que las unidades pueden trabajar en diferentes áreas
        return;

      case 'user':
      default:
        // user no puede crear proyectos
        throw new ForbiddenException('No tiene permisos para crear proyectos, por favor contacte con un administrador');
    }
  }

  // ==================== HELPER METHODS ====================

  private validateProjectDates(startDate?: string, dueDate?: string): void {
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);

      if (due < start) {
        throw new BadRequestException('La fecha de vencimiento no puede ser anterior a la fecha de inicio');
      }
    }
  }

  private validateProjectDatesForUpdate(
    existingProject: Project,
    startDate?: string,
    dueDate?: string
  ): void {
    // Usar las fechas del input o las existentes
    const finalStartDate = startDate || existingProject.startDate?.toISOString();
    const finalDueDate = dueDate || existingProject.dueDate?.toISOString();

    this.validateProjectDates(finalStartDate, finalDueDate);
  }

  // ==================== PROJECT METHODS ====================

  async findAllProjects(userId?: string, includeArchived = false): Promise<Project[]> {
    // Si no hay usuario, no puede ver proyectos
    if (!userId) {
      throw new ForbiddenException('Debe estar autenticado para ver proyectos');
    }

    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    let projects: any[] = [];

    switch (currentRole) {
      case 'super_admin':
        // Super_admin ve todos los proyectos (excepto eliminados)
        projects = await this.prisma.project.findMany({
          where: {
            status: { not: 'deleted' },
            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED)
          },
          include: {
            user: true, // editor
            category: {
              include: {
                area: true
              }
            },
            unit: {
              include: {
                type: true
              }
            },
            project_member: {
              include: {
                user: true,
              }
            }
          },
          orderBy: { name: 'asc' },
        });
        break;

      case 'area_role':
        // Admin/area_member ven proyectos de su área + proyectos donde es project_member
        const userAreas = await this.prisma.area_member.findMany({
          where: { iduser: userId },
          select: { idarea: true }
        });

        // También incluir área del admin si tiene membresía admin
        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });
        if (adminArea) {
          userAreas.push({ idarea: adminArea.idarea! });
        }

        const areaIds = [...new Set(userAreas.map(ua => ua.idarea))];

        // Obtener proyectos donde es project_member
        const areaProjectMembers = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true }
        });
        const areaProjectMemberIds = areaProjectMembers.map(pm => pm.idproject).filter(id => id !== null);

        // Combinar filtros: proyectos de área OR proyectos como member
        const areaWhereConditions: any[] = [];
        
        if (areaIds.length > 0) {
          areaWhereConditions.push({
            category: {
              id_area: { in: areaIds }
            }
          });
        }

        if (areaProjectMemberIds.length > 0) {
          areaWhereConditions.push({
            id: { in: areaProjectMemberIds }
          });
        }

        projects = await this.prisma.project.findMany({
          where: {
            OR: areaWhereConditions,
            status: { not: 'deleted' },
            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED)
          },
          include: {
            user: true, // editor
            category: {
              include: {
                area: true
              }
            },
            unit: {
              include: {
                type: true
              }
            },
            project_member: {
              include: {
                user: true,
              }
            }
          },
          orderBy: { name: 'asc' },
        });
        break;

      case 'unit_role':
        // Unit_role ve proyectos de su unidad + proyectos donde es project_member
        const userUnits = await this.prisma.unit_member.findMany({
          where: { iduser: userId },
          select: { idunit: true }
        });

        const unitIds = userUnits.map(uu => uu.idunit).filter(id => id !== null);

        // Obtener proyectos donde es project_member
        const unitProjectMembers = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true }
        });
        const unitProjectMemberIds = unitProjectMembers.map(pm => pm.idproject).filter(id => id !== null);

        // Combinar filtros: proyectos de unidad OR proyectos como member
        const unitWhereConditions: any[] = [];
        
        if (unitIds.length > 0) {
          unitWhereConditions.push({
            idunit: { in: unitIds }
          });
        }

        if (unitProjectMemberIds.length > 0) {
          unitWhereConditions.push({
            id: { in: unitProjectMemberIds }
          });
        }

        projects = await this.prisma.project.findMany({
          where: {
            OR: unitWhereConditions,
            status: { not: 'deleted' },
            ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED)
          },
          include: {
            user: true, // editor
            category: {
              include: {
                area: true
              }
            },
            unit: {
              include: {
                type: true
              }
            },
            project_member: {
              include: {
                user: true,
              }
            }
          },
          orderBy: { name: 'asc' },
        });
        break;


      case 'user':
      default:
        // User puede ver proyectos donde es project_member
        const userDirectProjects = await this.prisma.project_member.findMany({
          where: { iduser: userId },
          select: { idproject: true }
        });
        const userDirectProjectIds = userDirectProjects.map(pm => pm.idproject).filter(id => id !== null);

        if (userDirectProjectIds.length === 0) {
          // Si no es member de ningún proyecto, retornar array vacío
          projects = [];
        } else {
          projects = await this.prisma.project.findMany({
            where: {
              id: {
                in: userDirectProjectIds
              },
              status: { not: 'deleted' },
              ...(includeArchived ? {} : this.EXCLUDE_ARCHIVED)
            },
            include: {
              user: true, // editor
              category: {
                include: {
                  area: true
                }
              },
              unit: {
                include: {
                  type: true
                }
              },
              project_member: {
                include: {
                  user: true,
                }
              }
            },
            orderBy: { name: 'asc' },
          });
        }
    }

    return projects.map(project => this.mapProject(project));
  }

  async findProjectById(id: string, includeArchived = false, userId?: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        user: true, // editor
        category: { include: { area: true } },
        unit: { include: { type: true } },
        user_project_archived_byTouser: true, // archived by user
        project_member: { include: { user: true } }
      },
    });

    if (!project) return null;

    // Si no incluimos archivados y está archivado, retornar null
    if (!includeArchived && project.archived_at) return null;
    
    // Si se proporciona userId, validar permisos
    if (userId) {
      const hasPermission = await this.validateProjectViewPermissions(userId, project);
      if (!hasPermission) {
        throw new ForbiddenException('No tienes permisos para ver este proyecto');
      }
    }
    
    return this.mapProject(project);
  }

  private async validateProjectViewPermissions(userId: string, project: any): Promise<boolean> {
    // Obtener el system_role del usuario
    const userSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const currentRole = userSystemRole?.role?.name;

    switch (currentRole) {
      case 'super_admin':
        // Super_admin puede ver todos los proyectos
        return true;

      case 'area_role':
        // area_role puede ver proyectos de su área + proyectos donde es project_member
        const userAreas = await this.prisma.area_member.findMany({
          where: { iduser: userId },
          select: { idarea: true }
        });

        // También incluir área del admin si tiene membresía admin
        const adminArea = await this.prisma.admin.findFirst({
          where: { iduser: userId },
          select: { idarea: true }
        });
        if (adminArea) {
          userAreas.push({ idarea: adminArea.idarea! });
        }

        const areaIds = [...new Set(userAreas.map(ua => ua.idarea))];
        
        // Verificar si el proyecto pertenece a alguna de sus áreas
        if (project.category && areaIds.includes(project.category.id_area)) {
          return true;
        }

        // Verificar si es project_member del proyecto
        const isAreaProjectMember = await this.prisma.project_member.findFirst({
          where: { iduser: userId, idproject: project.id }
        });
        return !!isAreaProjectMember;

      case 'unit_role':
        // unit_role puede ver proyectos de su unidad + proyectos donde es project_member
        const userUnits = await this.prisma.unit_member.findMany({
          where: { iduser: userId },
          select: { idunit: true }
        });

        const unitIds = userUnits.map(uu => uu.idunit).filter(id => id !== null);
        
        // Verificar si el proyecto pertenece a alguna de sus unidades
        if (project.idunit && unitIds.includes(project.idunit)) {
          return true;
        }

        // Verificar si es project_member del proyecto
        const isUnitProjectMember = await this.prisma.project_member.findFirst({
          where: { iduser: userId, idproject: project.id }
        });
        return !!isUnitProjectMember;

      case 'user':
      default:
        // user solo puede ver proyectos donde es project_member
        const isDirectProjectMember = await this.prisma.project_member.findFirst({
          where: { iduser: userId, idproject: project.id }
        });
        return !!isDirectProjectMember;
    }
  }

  async createProject(createProjectInput: CreateProjectInput, editorId: string): Promise<Project> {
    // Validar fechas del proyecto
    this.validateProjectDates(createProjectInput.startDate, createProjectInput.dueDate);

    // Validar permisos para crear proyectos según el rol del usuario
    await this.validateProjectCreationPermissions(editorId, createProjectInput.categoryId);

    // Validar que la categoría existe (si se proporciona)
    if (createProjectInput.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: createProjectInput.categoryId },
        include: {
          area: true
        }
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

    // En el nuevo esquema, no necesitamos asignar roles específicos

    const project = await this.prisma.project.create({
      data: {
        name: createProjectInput.name,
        description: createProjectInput.description,
        startdate: createProjectInput.startDate ? new Date(createProjectInput.startDate) : null,
        duedate: createProjectInput.dueDate ? new Date(createProjectInput.dueDate) : null,
        review: createProjectInput.review,
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

    // Agregar automáticamente al creador como project_member del proyecto
    await this.prisma.project_member.create({
      data: {
        idproject: project.id,
        iduser: editorId,
      },
    });

    // Aplicar jerarquía de roles para el creador también
    await this.applyRoleHierarchyForProjectMember(editorId);

    return this.mapProject(project);
  }

  async updateProject(updateProjectInput: UpdateProjectInput, editorId: string): Promise<Project> {
    const existingProject = await this.findProjectById(updateProjectInput.id);
    if (!existingProject) {
      throw new NotFoundException(`Proyecto con ID ${updateProjectInput.id} no encontrado`);
    }

    // Validar permisos para actualizar proyectos
    await this.validateProjectUpdatePermissions(editorId, updateProjectInput.id);

    // Validar fechas del proyecto (considerando fechas existentes)
    this.validateProjectDatesForUpdate(
      existingProject,
      updateProjectInput.startDate,
      updateProjectInput.dueDate
    );

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
    if (updateProjectInput.review !== undefined) updateData.review = updateProjectInput.review;

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

    // Validar permisos para eliminar proyectos
    await this.validateProjectDeletePermissions(userId, id);

    // Obtener todos los procesos asociados al proyecto
    const processes = await this.prisma.process.findMany({
      where: { idproject: id },
      include: { task: true },
    });

    // Para cada proceso, cancelar las tareas que no estén completadas ni canceladas
    for (const process of processes) {
      const tasksToCancel = process.task.filter(
        task => task.status !== 'completed' && task.status !== 'cancelled'
      );

      // Actualizar tareas a estado cancelado
      if (tasksToCancel.length > 0) {
        await this.prisma.task.updateMany({
          where: {
            id: { in: tasksToCancel.map(t => t.id) },
          },
          data: {
            status: 'cancelled',
            editedat: new Date(),
            ideditor: userId,
          },
        });
      }
    }

    // Marcar procesos como cancelados (usando el campo review)
    if (processes.length > 0) {
      await this.prisma.process.updateMany({
        where: { idproject: id },
        data: {
          review: 'cancelled',
          editedat: new Date(),
          ideditor: userId,
        },
      });
    }

    // Marcar el proyecto como eliminado (soft delete)
    // Esto mantiene el historial de procesos y tareas canceladas para auditoría
    await this.prisma.project.update({
      where: { id },
      data: {
        status: 'deleted',
        editedat: new Date(),
        ideditor: userId,
      },
    });

    return true;
  }

  async findUnitProjects(unitId: number): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        idunit: unitId,
        status: { not: 'deleted' }
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

  async findAreaProjects(areaId: number): Promise<Project[]> {
    // Los proyectos se relacionan con áreas a través de las categorías
    const projects = await this.prisma.project.findMany({
      where: {
        category: {
          id_area: areaId
        },
        status: { not: 'deleted' }
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
      memberId: null, // Ya no usamos memberId
      member: null, // Ya no usamos member
    }));
  }

  async getProjectMemberById(id: string): Promise<any> {
    const member = await this.prisma.project_member.findUnique({
      where: { id },
      include: {
        user: true,
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
    // Super admin puede hacer cualquier cosa
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Admin del sistema puede hacer cualquier cosa
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) return true;

    // Verificar si es project_member con rol admin
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'admin' }
    });

    if (!adminRole) return false;

    const projectMember = await this.prisma.project_member.findFirst({
      where: {
        idproject: projectId,
        iduser: userId,
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

    // Validar permisos para agregar miembros según el rol del usuario
    await this.validateProjectMemberAdditionPermissions(requestUserId, addMemberInput.projectId);

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: addMemberInput.userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // En el nuevo esquema, no hay roles específicos en project_member

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

    // Aplicar jerarquía de roles para el usuario que se está agregando
    await this.applyRoleHierarchyForProjectMember(addMemberInput.userId);

    const member = await this.prisma.project_member.create({
      data: {
        idproject: addMemberInput.projectId,
        iduser: addMemberInput.userId,
      },
      include: {
        user: true,
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

    // En el nuevo esquema, no hay roles específicos en project_member

    // En el nuevo esquema, project_member solo indica pertenencia, no hay roles específicos
    const updatedMember = await this.prisma.project_member.update({
      where: { id: updateProjectMemberInput.id },
      data: {}, // No hay campos que actualizar en el nuevo esquema
      include: {
        user: true,
        project: true,
      },
    });

    return this.mapProjectMember(updatedMember);
  }

  // ==================== RESOLVER HELPER METHODS ====================

  async getCategoryById(categoryId: string): Promise<any> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        area: true
      }
    });

    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name
      } : null
    };
  }

  async getUnitById(unitId: number): Promise<any> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        type: true
      }
    });

    if (!unit) return null;

    return {
      id: unit.id,
      name: unit.name,
      idtype: unit.idtype,
      type: unit.type ? {
        id: unit.type.id,
        name: unit.type.name
      } : null
    };
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
      review: project.review,
      status: project.status || 'active',
      archivedAt: project.archived_at,
      archivedBy: project.archived_by,
      archivedByUser: project.user_project_archived_byTouser,
    };
  }

  private mapProjectMember(member: any): ProjectMember {
    return {
      id: member.id,
      userId: member.iduser,
      projectId: member.idproject,
      user: member.user ? {
        id: member.user.id,
        name: member.user.name || '',
        email: member.user.email,
        password: member.user.password || undefined,
        isActive: member.user.isactive ?? true,
        havePassword: member.user.havepassword ?? false,
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

    // Ya no necesitamos auto-asignar process_member

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
            task_member: {
              include: {
                user: true,
              },
            },
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

  // ==================== CATEGORY METHODS ====================

  async findAllCategories(): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      include: {
        area: true,
        project: true,
      },
      orderBy: { name: 'asc' }
    });

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name || undefined,
        admin: []
      } : undefined,
      createdAt: undefined, // No hay campo created_at en el esquema
      updatedAt: undefined, // No hay campo updated_at en el esquema
    }));
  }

  async findCategoryById(id: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        area: true,
        project: true,
      }
    });

    if (!category) return null;

    return {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name || undefined,
        admin: []
      } : undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }

  async findProjectsByCategory(categoryId: string, userId: string): Promise<Project[]> {
    // Verificar que la categoría existe
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new BadRequestException('La categoría especificada no existe');
    }

    // Obtener proyectos de la categoría
    const projects = await this.prisma.project.findMany({
      where: {
        idcategory: categoryId
      },
      include: {
        user: true, // editor
        unit: {
          include: {
            type: true
          }
        },
        category: true,
        process: {
          include: {
            user: true, // editor del proceso
            task: {
              include: {
                user: true, // editor de la tarea
                task_member: {
                  include: {
                    user: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return projects.map(project => this.mapProject(project));
  }

  async findProjectsByUnit(unitId: number, userId: string): Promise<Project[]> {
    // Verificar que la unidad existe
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId }
    });

    if (!unit) {
      throw new BadRequestException('La unidad especificada no existe');
    }

    // Obtener proyectos de la unidad
    const projects = await this.prisma.project.findMany({
      where: {
        idunit: unitId
      },
      include: {
        user: true, // editor
        unit: {
          include: {
            type: true
          }
        },
        category: true,
        process: {
          include: {
            user: true, // editor del proceso
            task: {
              include: {
                user: true, // editor de la tarea
                task_member: {
                  include: {
                    user: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return projects.map(project => this.mapProject(project));
  }

  async createCategory(createCategoryInput: CreateCategoryInput, editorId: string): Promise<Category> {
    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: createCategoryInput.areaId }
    });

    if (!area) {
      throw new BadRequestException('El área especificada no existe');
    }

    const category = await this.prisma.category.create({
      data: {
        name: createCategoryInput.name,
        description: createCategoryInput.description,
        id_area: createCategoryInput.areaId,
      },
      include: {
        area: true,
        project: true,
      }
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area || undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }

  async updateCategory(updateCategoryInput: UpdateCategoryInput, editorId: string): Promise<Category> {
    const existingCategory = await this.findCategoryById(updateCategoryInput.id);
    if (!existingCategory) {
      throw new NotFoundException(`Categoría con ID ${updateCategoryInput.id} no encontrada`);
    }

    const updateData: any = {};

    if (updateCategoryInput.name) updateData.name = updateCategoryInput.name;
    if (updateCategoryInput.description !== undefined) updateData.description = updateCategoryInput.description;
    if (updateCategoryInput.areaId) updateData.id_area = updateCategoryInput.areaId;

    const category = await this.prisma.category.update({
      where: { id: updateCategoryInput.id },
      data: updateData,
      include: {
        area: true,
        project: true,
      }
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area || undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }

  async deleteCategory(id: string, userId: string): Promise<boolean> {
    const category = await this.findCategoryById(id);
    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    // Verificar que no tenga proyectos asociados
    const projectsCount = await this.prisma.project.count({
      where: { idcategory: id }
    });

    if (projectsCount > 0) {
      throw new BadRequestException('No se puede eliminar la categoría porque tiene proyectos asociados');
    }

    await this.prisma.category.delete({
      where: { id }
    });

    return true;
  }

  // ==================== USERS NOT IN PROJECT ====================

  async getUsersNotInProject(projectId: string): Promise<User[]> {
    // Verificar que el proyecto existe
    const project = await this.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Obtener IDs de usuarios que ya están en el proyecto
    const projectMembers = await this.prisma.project_member.findMany({
      where: { idproject: projectId },
      select: { iduser: true }
    });

    const userIdsInProject = projectMembers
      .map(member => member.iduser)
      .filter((id): id is string => id !== null);

    // Obtener todos los usuarios activos que NO están en el proyecto
    const usersNotInProject = await this.prisma.user.findMany({
      where: {
        isactive: true,
        id: {
          notIn: userIdsInProject.length > 0 ? userIdsInProject : undefined
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

    return usersNotInProject.map(user => ({
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
  }

  // ==================== PROJECTS BY STATUS METHODS ====================

  async getProjectsByStatus(areaId: number): Promise<{ activeProjects: Project[]; inactiveProjects: Project[] }> {
    // Obtener proyectos activos del área
    const activeProjects = await this.prisma.project.findMany({
      where: {
        category: {
          id_area: areaId,
        },
        status: 'active',
      },
      include: {
        category: true,
        unit: true,
        user: true,
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

    // Obtener proyectos inactivos del área (inactive, completed, cancelled)
    const inactiveProjects = await this.prisma.project.findMany({
      where: {
        category: {
          id_area: areaId,
        },
        status: {
          in: ['inactive', 'completed', 'cancelled'],
        },
      },
      include: {
        category: true,
        unit: true,
        user: true,
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

    return {
      activeProjects: activeProjects.map(project => this.mapProject(project)),
      inactiveProjects: inactiveProjects.map(project => this.mapProject(project)),
    };
  }

  // ==================== PROJECT ARCHIVING METHODS ====================

  /**
   * Archiva solo el proyecto (sin tocar los procesos)
   * Uso: Cuando todos los procesos ya están archivados (automático)
   */
  async archiveProjectOnly(projectId: string, userId: string | null): Promise<Project> {
    const existingProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: true,
        category: true,
        unit: true,
        user_project_archived_byTouser: true,
      },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (existingProject.archived_at) {
      throw new BadRequestException('El proyecto ya está archivado');
    }

    // Archivar el proyecto
    const archivedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        archived_at: new Date(),
        archived_by: userId, // NULL si es automático, userId si es manual
      },
      include: {
        user: true,
        category: true,
        unit: true,
        user_project_archived_byTouser: true,
      },
    });

    return this.mapProject(archivedProject);
  }

  /**
   * Archiva el proyecto y TODOS sus procesos (con tareas y evidencias en cascada)
   * Uso: Archivado manual por admin
   */
  async archiveProjectWithProcesses(projectId: string, userId: string): Promise<Project> {
    const existingProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { category: true, unit: true },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (existingProject.archived_at) {
      throw new BadRequestException('El proyecto ya está archivado');
    }

    // Validar permisos para archivar proyecto
    await this.validateProjectDeletePermissions(userId, projectId);

    // 1. Obtener todos los procesos NO archivados del proyecto
    const activeProcesses = await this.prisma.process.findMany({
      where: {
        idproject: projectId,
        archived_at: null,
      },
    });

    // 2. Archivar cada proceso con sus tareas y evidencias
    for (const process of activeProcesses) {
      await this.processService.archiveProcessWithTasks(process.id, userId);
    }

    // 3. Archivar el proyecto
    const archivedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        archived_at: new Date(),
        archived_by: userId,
      },
      include: {
        user: true,
        category: true,
        unit: true,
        user_project_archived_byTouser: true,
      },
    });

    return this.mapProject(archivedProject);
  }



  async unarchiveProjectWithProcesses(projectId: string, userId: string): Promise<Project> {
    const existingProject = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    if (!existingProject.archived_at) {
      throw new BadRequestException('El proyecto no está archivado');
    }

    // Validar permisos
    await this.validateProjectDeletePermissions(userId, projectId);

    // 1. Obtener todos los procesos archivados del proyecto
    const archivedProcesses = await this.prisma.process.findMany({
      where: {
        idproject: projectId,
        archived_at: { not: null },
      },
    });

    // 2. Desarchivar cada proceso (con tareas y evidencias)
    for (const process of archivedProcesses) {
      await this.processService.unarchiveProcessWithTasks(process.id, userId);
    }

    // 3. Desarchivar el proyecto
    const unarchivedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        archived_at: null,
        archived_by: null,
      },
      include: {
        user: true,
        category: true,
        unit: true,
        user_project_archived_byTouser: true,
      },
    });

    return this.mapProject(unarchivedProject);
  }

}
