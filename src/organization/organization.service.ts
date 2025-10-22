import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';
import { CreateAreaInput, UpdateAreaInput } from './dto/area.dto';
import { CreateUnitInput, UpdateUnitInput } from './dto/unit.dto';
import { CreateUnitMemberInput, UpdateUnitMemberInput } from './dto/unit-member.dto';
import { CreateTypeInput, UpdateTypeInput } from './dto/type.dto';
import { CreateAdminInput, AssignSuperAdminInput } from './dto/admin.dto';
import { CreateAreaMemberInput } from './dto/area-member.dto';
import { CreateCategoryInput, UpdateCategoryInput } from '../project/dto/category.dto';
import { SystemRoleService } from '../auth/system-role/system-role.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private systemRoleService: SystemRoleService,
    private userService: UserService,
  ) { }

  // ===== AREA METHODS =====
  async createArea(createAreaInput: CreateAreaInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede crear áreas)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden crear áreas');
    }

    // Crear el área
    const area = await this.prisma.area.create({
      data: {
        name: createAreaInput.name,
      },
      include: {
        admin: true,
        category: true,
      },
    });

    // NOTA: No auto-asignar al super_admin como area_member
    // El super_admin tiene acceso global y no necesita ser miembro de áreas específicas
    // Solo se auto-asigna cuando un admin (no super_admin) crea un área

    return area;
  }

  async findAllAreas(currentUser?: User) {
    // Si no hay usuario, mostrar todas las áreas con información básica
    if (!currentUser) {
      return this.prisma.area.findMany({
        include: {
          admin: {
            include: {
              user: true
            }
          },
          category: true,
        },
      });
    }

    // Verificar si el usuario es super_admin
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (isSuperAdmin) {
      // Super_admin puede ver todas las áreas
      return this.prisma.area.findMany({
        include: {
          admin: {
            include: {
              user: true
            }
          },
          category: true,
          area_member: {
            include: {
              user: true
            }
          }
        },
      });
    }

    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isAreaMember = await this.userService.isAreaMemberOfAny(currentUser.id);

    if (isAdmin || isAreaMember) {
      // Obtener todas las áreas donde el usuario tiene permisos
      const adminAreas = isAdmin ? await this.getAdminAreas(currentUser.id) : [];
      const memberAreas = isAreaMember ? await this.getAreaMemberAreas(currentUser.id) : [];

      // Combinar áreas y eliminar duplicados
      const allUserAreas = [...new Set([...adminAreas, ...memberAreas])];

      if (allUserAreas.length === 0) {
        throw new ForbiddenException('Usuario no asociado a ningún área');
      }

      return this.prisma.area.findMany({
        where: {
          id: {
            in: allUserAreas
          }
        },
        include: {
          admin: {
            include: {
              user: true
            }
          },
          category: true,
          area_member: {
            include: {
              user: true
            }
          }
        },
      });
    }

    // Para cualquier otro usuario, no puede ver áreas
    throw new ForbiddenException('No tiene permisos para ver las áreas');
  }

  async findAreaById(id: number) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        admin: true,
        category: true,
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return area;
  }

  async updateArea(updateAreaInput: UpdateAreaInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede editar áreas)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden actualizar áreas');
    }

    await this.findAreaById(updateAreaInput.id);

    return this.prisma.area.update({
      where: { id: updateAreaInput.id },
      data: {
        name: updateAreaInput.name,
      },
      include: {
        admin: true,
        category: true,
      },
    });
  }

  async removeArea(id: number, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede eliminar áreas)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden eliminar áreas');
    }

    await this.findAreaById(id);

    return this.prisma.area.delete({
      where: { id },
    });
  }

  // ===== UNIT METHODS =====
  async createUnit(createUnitInput: CreateUnitInput, currentUser: User) {
    // La verificación de permisos se hace en el guard (RequireUnitCreation)
    // Esto permite tanto super_admin como admin/area_member (con membresía) crear unidades

    // Verificar que el tipo de unidad existe
    if (createUnitInput.idtype) {
      const type = await this.prisma.type.findUnique({
        where: { id: createUnitInput.idtype }
      });

      if (!type) {
        throw new NotFoundException(`Tipo con ID ${createUnitInput.idtype} no encontrado`);
      }
    }

    // Crear la unidad (super_admin no necesita admin record)
    const unit = await this.prisma.unit.create({
      data: {
        name: createUnitInput.name,
        idtype: createUnitInput.idtype,
        idadmin: null, // Super_admin no se asigna como admin de la unidad
      },
      include: {
        type: true,
        admin: {
          include: {
            user: true,
            area: true,
          },
        },
        project: true,
        unit_member: true,
      },
    });

    // Super_admin no se autoasigna como unit_member
    // Las unidades se crean sin admin asignado y sin autoasignación de miembros

    return unit;
  }

  async findAllUnits(currentUser?: User) {
    // Si no hay usuario, mostrar todas las unidades con información básica
    if (!currentUser) {
      return this.prisma.unit.findMany({
        include: {
          type: true,
          admin: {
            include: {
              user: true,
              area: true,
            },
          },
          project: true,
          unit_member: true,
        },
      });
    }

    // Verificar si el usuario es super_admin (puede ver todo)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (isSuperAdmin) {
      return this.prisma.unit.findMany({
        include: {
          type: true,
          admin: {
            include: {
              user: true,
              area: true,
            },
          },
          project: {
            include: {
              category: true
            }
          },
          unit_member: {
            include: {
              user: true,
            }
          },
        },
      });
    }

    // Verificar si el usuario tiene permisos para ver unidades
    const userWithRoles = await this.userService.findByIdWithRoles(currentUser.id);
    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    if (userSystemRole === 'unit_role' || userSystemRole === 'area_role') {
      // unit_role y area_role pueden ver todas las unidades
      // area_role (admin/area_member) necesita ver unidades para asignar proyectos
      // unit_role (unit_member) necesita ver unidades para gestionar proyectos
      return this.prisma.unit.findMany({
        include: {
          type: true,
          admin: {
            include: {
              user: true,
              area: true,
            },
          },
          project: {
            include: {
              category: true
            }
          },
          unit_member: {
            include: {
              user: true,
            }
          },
        },
      });
    }

    // Para cualquier otro usuario (user)
    // No pueden ver unidades
    throw new ForbiddenException('No tienes permisos para ver las unidades');
  }

  async findUnitById(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        type: true,
        project: true,
        unit_member: true,
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${id} no encontrada`);
    }

    return unit;
  }

  async updateUnit(updateUnitInput: UpdateUnitInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede actualizar unidades)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden actualizar unidades');
    }

    await this.findUnitById(updateUnitInput.id);

    return this.prisma.unit.update({
      where: { id: updateUnitInput.id },
      data: {
        name: updateUnitInput.name,
        idtype: updateUnitInput.idtype,
      },
      include: {
        type: true,
        project: true,
        unit_member: true,
      },
    });
  }

  async removeUnit(id: number, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede eliminar unidades)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden eliminar unidades');
    }

    await this.findUnitById(id);

    return this.prisma.unit.delete({
      where: { id },
    });
  }

  // ===== UNIT MEMBER METHODS =====
  async addUnitMember(createUnitMemberInput: CreateUnitMemberInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede agregar miembros a unidades)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden agregar miembros a unidades');
    }

    // Verificar que la unidad existe
    const unit = await this.prisma.unit.findUnique({
      where: { id: createUnitMemberInput.idunit },
      include: {
        admin: true,
        type: true,
      }
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${createUnitMemberInput.idunit} no encontrada`);
    }

    // Super_admin puede agregar miembros a cualquier unidad (no necesita verificación adicional)

    // Verificar que el usuario a agregar existe
    const userToAdd = await this.prisma.user.findUnique({
      where: { id: createUnitMemberInput.iduser }
    });

    if (!userToAdd) {
      throw new NotFoundException(`Usuario con ID ${createUnitMemberInput.iduser} no encontrado`);
    }

    // Verificar que no sea ya miembro de esa unidad
    const existingMember = await this.prisma.unit_member.findFirst({
      where: {
        iduser: createUnitMemberInput.iduser,
        idunit: createUnitMemberInput.idunit
      }
    });

    if (existingMember) {
      throw new ForbiddenException('El usuario ya es miembro de esta unidad');
    }

    // Crear entrada en tabla unit_member (sin rol específico)
    const unitMember = await this.prisma.unit_member.create({
      data: {
        iduser: createUnitMemberInput.iduser,
        idunit: createUnitMemberInput.idunit,
      },
      include: {
        user: true,
        unit: true,
      },
    });

    // Promover automáticamente el system_role del usuario
    await this.promoteUserSystemRole(createUnitMemberInput.iduser);

    return unitMember;
  }

  async updateUnitMember(updateUnitMemberInput: UpdateUnitMemberInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede actualizar miembros de unidades)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden actualizar miembros de unidades');
    }

    // Super_admin puede actualizar miembros de cualquier unidad

    // Obtener el miembro a actualizar
    const member = await this.prisma.unit_member.findUnique({
      where: { id: updateUnitMemberInput.id },
      include: {
        unit: {
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

    if (!member) {
      throw new NotFoundException(`Miembro de unidad con ID ${updateUnitMemberInput.id} no encontrado`);
    }

    if (!member.idunit) {
      throw new NotFoundException('El miembro no está asignado a ninguna unidad');
    }

    // Verificar permisos específicos para la unidad
    if (!member.unit) {
      throw new NotFoundException('La unidad asociada al miembro no existe');
    }

    // Super_admin puede actualizar miembros de cualquier unidad (no necesita verificación adicional)

    // Verificar que el usuario a actualizar existe
    if (updateUnitMemberInput.iduser) {
      const userToUpdate = await this.prisma.user.findUnique({
        where: { id: updateUnitMemberInput.iduser }
      });

      if (!userToUpdate) {
        throw new NotFoundException(`Usuario con ID ${updateUnitMemberInput.iduser} no encontrado`);
      }
    }

    return this.prisma.unit_member.update({
      where: { id: updateUnitMemberInput.id },
      data: {
        iduser: updateUnitMemberInput.iduser,
        idunit: updateUnitMemberInput.idunit,
      },
      include: {
        user: true,
        unit: true,
      },
    });
  }

  async removeUnitMember(id: string, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede eliminar miembros de unidades)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden eliminar miembros de unidades');
    }

    // Super_admin puede eliminar miembros de cualquier unidad

    const member = await this.prisma.unit_member.findUnique({
      where: { id },
      include: {
        unit: {
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

    if (!member) {
      throw new NotFoundException(`Miembro de unidad con ID ${id} no encontrado`);
    }

    if (!member.idunit) {
      throw new NotFoundException('El miembro no está asignado a ninguna unidad');
    }

    // Verificar permisos específicos para la unidad
    if (!member.unit) {
      throw new NotFoundException('La unidad asociada al miembro no existe');
    }

    // Super_admin puede eliminar miembros de cualquier unidad (no necesita verificación adicional)

    const deletedMember = await this.prisma.unit_member.delete({
      where: { id },
    });

    // Recalcular automáticamente el system_role basado en membresías restantes
    if (deletedMember.iduser) {
      await this.promoteUserSystemRole(deletedMember.iduser);
    }

    return deletedMember;
  }

  async findUnitMembers(unitId: number, currentUser?: User) {
    // Si no hay usuario, mostrar todos los miembros
    if (!currentUser) {
      return this.prisma.unit_member.findMany({
        where: { idunit: unitId },
        include: {
          user: true,
          unit: true,
        },
      });
    }

    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      // Si no es admin, mostrar solo si es miembro de la unidad
      const isMember = await this.prisma.unit_member.findFirst({
        where: {
          idunit: unitId,
          iduser: currentUser.id
        }
      });

      if (!isMember) {
        throw new ForbiddenException('No tienes permisos para ver los miembros de esta unidad');
      }

      return this.prisma.unit_member.findMany({
        where: { idunit: unitId },
        include: {
          user: true,
          unit: true,
        },
      });
    }

    // Si es admin, verificar que la unidad esté en su área
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Verificar que la unidad esté en el área del admin
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        project: {
          include: {
            category: true
          }
        }
      }
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${unitId} no encontrada`);
    }

    const unitInAdminArea = unit.project.some(project =>
      project.category && project.category.id_area === adminArea
    );

    if (!unitInAdminArea) {
      throw new ForbiddenException('Solo puedes ver miembros de unidades de tu área');
    }

    return this.prisma.unit_member.findMany({
      where: { idunit: unitId },
      include: {
        user: true,
        unit: true,
      },
    });
  }

  async getAvailableUsersForArea(areaId: number, currentUser: User): Promise<any> {
    // Obtener información del usuario con roles
    const userWithRoles = await this.userService.findByIdWithRoles(currentUser.id);

    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    // Solo super_admin y area_role pueden ver usuarios disponibles
    if (userSystemRole !== 'super_admin' && userSystemRole !== 'area_role') {
      throw new ForbiddenException('Solo los administradores y miembros de área pueden ver usuarios disponibles');
    }

    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: areaId }
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${areaId} no encontrada`);
    }

    // Verificar permisos según el rol
    if (userSystemRole === 'super_admin') {
      // Super admin puede ver cualquier área
    } else if (userSystemRole === 'area_role') {
      // area_role puede ver solo las áreas que gestiona
      // Verificar si es admin (tiene membresía admin)
      const adminRecord = await this.prisma.admin.findFirst({
        where: {
          iduser: currentUser.id,
          idarea: areaId
        }
      });

      if (adminRecord) {
        // Es admin de esta área, puede ver usuarios
      } else {
        // No es admin, verificar si es area_member
        const areaMemberRecord = await this.prisma.area_member.findFirst({
          where: {
            iduser: currentUser.id,
            idarea: areaId
          }
        });

        if (!areaMemberRecord) {
          throw new ForbiddenException('Solo puedes ver usuarios disponibles para áreas donde eres admin o miembro');
        }
      }
    } else {
      // Otros roles no pueden ver usuarios disponibles
      throw new ForbiddenException('No tienes permisos para ver usuarios disponibles');
    }

    // Obtener TODOS los usuarios activos con sus relaciones
    const allUsers = await this.prisma.user.findMany({
      where: { isactive: true },
      include: {
        system_role: { include: { role: true } },
        admin: { include: { area: true } },
        area_member: { include: { area: true } }
      },
      orderBy: { name: 'asc' }
    });

    // Separar usuarios en dos categorías
    const usersInThisArea: any[] = [];
    const availableUsers: any[] = [];

    allUsers.forEach(user => {
      const isAdminInThisArea = user.admin.some(admin => admin.idarea === areaId);
      const isMemberInThisArea = user.area_member.some(member => member.idarea === areaId);

      const userData = {
        id: user.id,
        name: user.name || '',
        email: user.email,
        isActive: user.isactive ?? true,
        havePassword: user.havepassword ?? false,
        // Información del área actual del usuario
        currentAreaName: user.admin?.[0]?.area?.name || user.area_member?.[0]?.area?.name || null,
        currentAreaId: user.admin?.[0]?.idarea || user.area_member?.[0]?.idarea || null,
        // Información de su rol en el sistema
        systemRole: user.system_role?.role?.name || 'user',
        // Relación con el área consultada
        relationshipWithArea: isAdminInThisArea ? 'admin' : (isMemberInThisArea ? 'member' : 'none'),
        // Información adicional
        canBeAdded: !isAdminInThisArea && !isMemberInThisArea && user.system_role?.role?.name !== 'super_admin'
      };

      if (isAdminInThisArea || isMemberInThisArea) {
        usersInThisArea.push(userData);
      } else if (userData.canBeAdded) {
        availableUsers.push(userData);
      }
    });

    return {
      // Usuarios que YA están en esta área
      currentAreaUsers: usersInThisArea,
      // Usuarios que PUEDEN ser agregados a esta área
      availableUsers: availableUsers,
      // Información del área
      areaId: areaId,
      areaName: area.name
    };
  }


  // Método para que un admin vea solo sus unidades
  async getMyUnitsAsAdmin(currentUser: User) {
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden acceder a esta función');
    }

    // Obtener el admin record del usuario actual
    const adminRecord = await this.prisma.admin.findFirst({
      where: { iduser: currentUser.id }
    });

    if (!adminRecord) {
      throw new ForbiddenException('Usuario admin no encontrado en el sistema');
    }

    // Obtener solo las unidades que gestiona este admin
    return this.prisma.unit.findMany({
      where: {
        idadmin: adminRecord.id,
      },
      include: {
        type: true,
        admin: {
          include: {
            user: true,
            area: true,
          },
        },
        project: {
          include: {
            category: true
          }
        },
        unit_member: {
          include: {
            user: true,
          }
        },
      },
    });
  }

  // ===== HELPER METHODS =====
  private async isUserAdmin(userId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findFirst({
      where: { iduser: userId },
    });
    return !!admin;
  }

  private async isUserSuperAdmin(userId: string): Promise<boolean> {
    const systemRole = await this.prisma.system_role.findFirst({
      where: {
        user_id: userId,
        role: { name: 'super_admin' }
      },
      include: { role: true }
    });
    return !!systemRole;
  }

  private async isUserUnitAdmin(userId: string, unitId: number): Promise<boolean> {
    // Verificar si es admin general (tabla admin)
    const isAdmin = await this.isUserAdmin(userId);
    if (isAdmin) return true;

    // En el nuevo esquema, no hay roles específicos en unit_member
    // Un usuario puede gestionar una unidad si es admin del área correspondiente
    // o si tiene rol de sistema area_role o superior

    // Verificar rol de sistema
    const systemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const roleName = systemRole?.role?.name;

    // super_admin y area_role pueden gestionar unidades
    return roleName === 'super_admin' || roleName === 'area_role';
  }

  // ===== TYPE METHODS =====
  async findAllTypes(currentUser?: User) {
    // Si no hay usuario, mostrar todos los tipos
    if (!currentUser) {
      return this.prisma.type.findMany();
    }

    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      // Si no es admin, mostrar todos los tipos
      return this.prisma.type.findMany();
    }

    // Si es admin, mostrar solo los tipos que están siendo usados en su área
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Obtener tipos que están siendo usados por unidades de proyectos de la categoría del área del admin
    // También incluir tipos que no están siendo usados (para que pueda crear nuevas unidades con nuevos tipos)
    const typesInUse = await this.prisma.type.findMany({
      where: {
        unit: {
          some: {
            project: {
              some: {
                category: {
                  id_area: adminArea
                }
              }
            }
          }
        }
      }
    });

    // Obtener todos los tipos para que el admin pueda crear nuevas unidades con tipos existentes
    const allTypes = await this.prisma.type.findMany();

    // Combinar y eliminar duplicados
    const combinedTypes = [...typesInUse, ...allTypes];
    const uniqueTypes = combinedTypes.filter((type, index, self) =>
      index === self.findIndex(t => t.id === type.id)
    );

    return uniqueTypes;
  }

  async findTypeById(id: number) {
    const type = await this.prisma.type.findUnique({
      where: { id },
    });

    if (!type) {
      throw new NotFoundException(`Tipo con ID ${id} no encontrado`);
    }

    return type;
  }

  async createType(createTypeInput: CreateTypeInput, currentUser: User) {
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden crear tipos');
    }

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Verificar que el nombre del tipo no exista ya
    const existingType = await this.prisma.type.findUnique({
      where: { name: createTypeInput.name }
    });

    if (existingType) {
      throw new ForbiddenException('Ya existe un tipo con ese nombre');
    }

    // Crear el tipo (los tipos son globales pero se usan en unidades del área del admin)
    return this.prisma.type.create({
      data: {
        name: createTypeInput.name,
      },
    });
  }

  async removeType(id: number, currentUser: User) {
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar tipos');
    }

    // Verificar que el tipo existe
    await this.findTypeById(id);

    // Verificar que no esté siendo usado por unidades
    const unitsUsingType = await this.prisma.unit.findMany({
      where: { idtype: id },
    });

    if (unitsUsingType.length > 0) {
      throw new ForbiddenException('No se puede eliminar el tipo porque está siendo usado por unidades');
    }

    return this.prisma.type.delete({
      where: { id },
    });
  }

  // ===== ADMIN METHODS =====
  async findAllAdmins(): Promise<any[]> {
    const admins = await this.prisma.admin.findMany({
      include: {
        area: true,
        user: true,
      },
    });

    return admins.map(admin => ({
      id: admin.id,
      idArea: admin.idarea,
      idUser: admin.iduser,
      area: admin.area ? {
        id: admin.area.id,
        name: admin.area.name,
      } : null,
      user: admin.user ? {
        id: admin.user.id,
        name: admin.user.name || '',
        email: admin.user.email,
        password: admin.user.password || undefined,
        isActive: admin.user.isactive ?? true,
        havePassword: admin.user.havepassword ?? false,
      } : null,
    }));
  }

  async findAdminById(id: string): Promise<any> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: {
        area: true,
        user: true,
      },
    });

    if (!admin) {
      throw new NotFoundException(`Administrador con ID ${id} no encontrado`);
    }

    return {
      id: admin.id,
      idArea: admin.idarea,
      idUser: admin.iduser,
      area: admin.area ? {
        id: admin.area.id,
        name: admin.area.name,
      } : null,
      user: admin.user ? {
        id: admin.user.id,
        name: admin.user.name || '',
        email: admin.user.email,
        password: admin.user.password || undefined,
        isActive: admin.user.isactive ?? true,
        havePassword: admin.user.havepassword ?? false,
      } : null,
    };
  }

  async createAdmin(createAdminInput: CreateAdminInput, currentUser: User): Promise<any> {
    // Verificar si el usuario actual es super_admin o admin
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    const isAdmin = await this.isUserAdmin(currentUser.id);

    if (!isSuperAdmin && !isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden crear otros administradores');
    }

    // Si es admin (no super_admin), verificar que está agregando a su área
    if (isAdmin && !isSuperAdmin) {
      const adminArea = await this.getAdminArea(currentUser.id);
      if (!adminArea) {
        throw new ForbiddenException('Admin no asociado a ningún área');
      }
      if (createAdminInput.idArea !== adminArea) {
        throw new ForbiddenException('Solo puedes agregar administradores a tu área');
      }
    }

    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: createAdminInput.idArea },
    });
    if (!area) {
      throw new NotFoundException(`Área con ID ${createAdminInput.idArea} no encontrada`);
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: createAdminInput.idUser },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${createAdminInput.idUser} no encontrado`);
    }

    // Verificar que no sea ya admin de esa área
    const existingAdmin = await this.prisma.admin.findFirst({
      where: {
        idarea: createAdminInput.idArea,
        iduser: createAdminInput.idUser,
      },
    });
    if (existingAdmin) {
      throw new ForbiddenException('El usuario ya es administrador de esta área');
    }

    const admin = await this.prisma.admin.create({
      data: {
        idarea: createAdminInput.idArea,
        iduser: createAdminInput.idUser,
      },
      include: {
        area: true,
        user: true,
      },
    });

    // Promover automáticamente el system_role del usuario
    await this.promoteUserSystemRole(createAdminInput.idUser);

    return {
      id: admin.id,
      idArea: admin.idarea,
      idUser: admin.iduser,
      area: admin.area ? {
        id: admin.area.id,
        name: admin.area.name,
      } : null,
      user: admin.user ? {
        id: admin.user.id,
        name: admin.user.name || '',
        email: admin.user.email,
        password: admin.user.password || undefined,
        isActive: admin.user.isactive ?? true,
        havePassword: admin.user.havepassword ?? false,
      } : null,
    };
  }

  async removeAdmin(id: string, currentUser: User): Promise<string> {
    // Verificar si el usuario actual es super_admin o admin
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    const isAdmin = await this.isUserAdmin(currentUser.id);

    if (!isSuperAdmin && !isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar otros administradores');
    }

    // Verificar que el admin existe
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });
    if (!admin) {
      throw new NotFoundException(`Administrador con ID ${id} no encontrado`);
    }

    // Si es admin (no super_admin), verificar que está eliminando de su área
    if (isAdmin && !isSuperAdmin) {
      const adminArea = await this.getAdminArea(currentUser.id);
      if (!adminArea) {
        throw new ForbiddenException('Admin no asociado a ningún área');
      }
      if (admin.idarea !== adminArea) {
        throw new ForbiddenException('Solo puedes eliminar administradores de tu área');
      }
    }

    // Verificar que no se esté eliminando a sí mismo
    if (admin.iduser === currentUser.id) {
      throw new ForbiddenException('No puedes eliminar tu propio rol de administrador');
    }

    await this.prisma.admin.delete({
      where: { id },
    });

    // Recalcular automáticamente el system_role basado en membresías restantes
    if (admin.iduser) {
      await this.promoteUserSystemRole(admin.iduser);
    }

    return `Administrador con ID ${id} eliminado exitosamente`;
  }

  async assignSuperAdmin(assignSuperAdminInput: AssignSuperAdminInput, currentUser: User): Promise<any> {
    // Verificar si el usuario actual es super_admin (solo super_admin puede asignar super_admin)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden asignar otros super administradores');
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: assignSuperAdminInput.idUser },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${assignSuperAdminInput.idUser} no encontrado`);
    }

    // Verificar que no sea ya super_admin
    const existingSuperAdmin = await this.prisma.system_role.findFirst({
      where: {
        user_id: assignSuperAdminInput.idUser,
        role: { name: 'super_admin' }
      },
      include: { role: true }
    });
    if (existingSuperAdmin) {
      throw new ForbiddenException('El usuario ya es super administrador');
    }

    // Obtener el rol super_admin
    const superAdminRole = await this.prisma.role.findFirst({
      where: { name: 'super_admin' }
    });
    if (!superAdminRole) {
      throw new NotFoundException('Rol super_admin no encontrado');
    }

    // Asignar el rol super_admin al usuario usando SystemRoleService
    await this.systemRoleService.updateUserSystemRole(assignSuperAdminInput.idUser, superAdminRole.id);

    // Nota: No llamamos a promoteUserSystemRole aquí porque super_admin es una asignación directa
    // que anula cualquier lógica de promoción basada en membresías

    // Obtener el system_role actualizado para la respuesta
    const systemRole = await this.prisma.system_role.findUnique({
      where: { user_id: assignSuperAdminInput.idUser },
      include: {
        role: true,
        user: true,
      },
    });

    if (!systemRole) {
      throw new Error('Error al actualizar el rol del usuario');
    }

    return {
      id: systemRole.id,
      userId: systemRole.user_id,
      roleId: systemRole.role_id,
      createdAt: systemRole.created_at,
      role: systemRole.role,
      user: systemRole.user ? {
        id: systemRole.user.id,
        name: systemRole.user.name || '',
        email: systemRole.user.email,
        isActive: systemRole.user.isactive ?? true,
        havePassword: systemRole.user.havepassword ?? false,
      } : null,
    };
  }

  // ===== HELPER METHODS FOR ADMIN AREA =====
  private async getAdminArea(userId: string): Promise<number | null> {
    // Obtener el área del admin (mantener para compatibilidad con código existente)
    const adminRecord = await this.prisma.admin.findFirst({
      where: { iduser: userId },
      select: { idarea: true }
    });

    return adminRecord?.idarea || null;
  }

  private async getAdminAreas(userId: string): Promise<number[]> {
    // Obtener TODAS las áreas donde el usuario es admin
    const adminRecords = await this.prisma.admin.findMany({
      where: { iduser: userId },
      select: { idarea: true }
    });

    return adminRecords.map(record => record.idarea).filter((id): id is number => id !== null);
  }

  private async getAreaMemberAreas(userId: string): Promise<number[]> {
    // Obtener TODAS las áreas donde el usuario es area_member
    const areaMemberRecords = await this.prisma.area_member.findMany({
      where: { iduser: userId },
      select: { idarea: true }
    });

    return areaMemberRecords.map(record => record.idarea).filter((id): id is number => id !== null);
  }

  private async isAdminOfArea(userId: string, areaId: number): Promise<boolean> {
    // Verificar si el usuario es admin de un área específica
    const adminRecord = await this.prisma.admin.findFirst({
      where: {
        iduser: userId,
        idarea: areaId
      }
    });

    return !!adminRecord;
  }

  // ===== AREA-SPECIFIC TYPE METHODS =====
  async getTypesByArea(areaId: number): Promise<any[]> {
    // Obtener tipos que están siendo usados en unidades de proyectos de una área específica
    return this.prisma.type.findMany({
      where: {
        unit: {
          some: {
            project: {
              some: {
                category: {
                  id_area: areaId
                }
              }
            }
          }
        }
      }
    });
  }

  async getMyAreaTypes(currentUser: User): Promise<any[]> {
    // Obtener tipos del área del admin actual
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    return this.getTypesByArea(adminArea);
  }

  // ===== CATEGORY METHODS FOR ADMIN =====
  async findAllCategoriesForAdmin(currentUser: User): Promise<any[]> {
    // Verificar si el usuario es admin o super_admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Solo los administradores pueden ver todas las categorías');
    }

    // Los admins y super_admins pueden ver todas las categorías del sistema
    const categories = await this.prisma.category.findMany({
      include: {
        area: true,
        project: true,
      },
    });

    // Mapear las categorías para incluir el areaId y el objeto area
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

  // ===== USER MANAGEMENT METHODS =====
  async getAvailableUsersForUnit(unitId: number, currentUser: User): Promise<User[]> {
    // Verificar si el usuario es admin o super_admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);

    if (!isAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Solo los administradores pueden ver usuarios disponibles');
    }

    // Si es super_admin, puede ver usuarios de cualquier unidad
    if (isSuperAdmin) {
      // Verificar que la unidad existe
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId }
      });

      if (!unit) {
        throw new NotFoundException(`Unidad con ID ${unitId} no encontrada`);
      }
    } else {
      // Si es admin, verificar que la unidad le pertenece directamente
      const adminRecord = await this.prisma.admin.findFirst({
        where: { iduser: currentUser.id }
      });

      if (!adminRecord) {
        throw new ForbiddenException('Usuario admin no encontrado en el sistema');
      }

      // Verificar que la unidad existe y pertenece al admin actual
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          admin: true,
        }
      });

      if (!unit) {
        throw new NotFoundException(`Unidad con ID ${unitId} no encontrada`);
      }

      if (unit.idadmin !== adminRecord.id) {
        throw new ForbiddenException('Solo puedes ver usuarios disponibles para unidades que gestionas directamente');
      }
    }

    // Obtener todos los usuarios activos
    const allUsers = await this.prisma.user.findMany({
      where: { isactive: true }
    });

    // Obtener usuarios que ya son miembros de esta unidad
    const existingMembers = await this.prisma.unit_member.findMany({
      where: { idunit: unitId },
      select: { iduser: true }
    });

    const existingMemberIds = existingMembers.map(member => member.iduser);

    // Filtrar usuarios que no son miembros de esta unidad
    const availableUsers = allUsers.filter(user => !existingMemberIds.includes(user.id));

    // Mapear los campos de Prisma a la entidad User de GraphQL
    return availableUsers.map(user => ({
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
      systemRole: undefined, // Los roles se incluyen cuando se consulta específicamente
      createdAt: undefined,
      updatedAt: undefined
    }));
  }

  // ===== AREA_MEMBER METHODS =====

  private mapAreaMember(areaMember: any): any {
    return {
      id: areaMember.id,
      areaId: areaMember.idarea,
      userId: areaMember.iduser,
      area: areaMember.area,
      user: areaMember.user,
    };
  }

  async createAreaMember(createAreaMemberInput: CreateAreaMemberInput, currentUser: User) {
    // Verificar permisos: solo super_admin y admin pueden agregar miembros al área
    const userWithRoles = await this.userService.findByIdWithRoles(currentUser.id);
    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    if (userSystemRole === 'super_admin') {
      // Super admin puede agregar miembros a cualquier área
    } else if (userSystemRole === 'area_role') {
      // area_role puede agregar miembros solo si es admin (no area_member)
      const isAdmin = await this.prisma.admin.findFirst({
        where: { iduser: currentUser.id }
      });

      if (!isAdmin) {
        throw new ForbiddenException('Solo los admins pueden agregar usuarios al área');
      }

      // Verificar que el admin puede agregar miembros a esta área específica
      const adminArea = await this.prisma.admin.findFirst({
        where: {
          iduser: currentUser.id,
          idarea: createAreaMemberInput.areaId
        }
      });

      if (!adminArea) {
        throw new ForbiddenException('Solo puedes agregar usuarios a las áreas que administras');
      }
    } else {
      throw new ForbiddenException('No tienes permisos para agregar usuarios al área');
    }

    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: createAreaMemberInput.areaId },
    });

    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }

    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: createAreaMemberInput.userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que no es ya miembro del área
    const existingMember = await this.prisma.area_member.findFirst({
      where: {
        idarea: createAreaMemberInput.areaId,
        iduser: createAreaMemberInput.userId,
      },
    });

    if (existingMember) {
      throw new ForbiddenException('El usuario ya es miembro de esta área');
    }

    // Crear entrada en tabla area_member
    const areaMember = await this.prisma.area_member.create({
      data: {
        idarea: createAreaMemberInput.areaId,
        iduser: createAreaMemberInput.userId,
      },
      include: {
        area: true,
        user: true,
      },
    });

    // Promover automáticamente el system_role del usuario
    await this.promoteUserSystemRole(createAreaMemberInput.userId);

    return this.mapAreaMember(areaMember);
  }

  async findAllAreaMembers() {
    const areaMembers = await this.prisma.area_member.findMany({
      include: {
        area: true,
        user: true,
      },
    });

    return areaMembers.map(areaMember => this.mapAreaMember(areaMember));
  }

  async findAreaMembersByArea(areaId: number) {
    const areaMembers = await this.prisma.area_member.findMany({
      where: { idarea: areaId },
      include: {
        area: true,
        user: true,
      },
    });

    return areaMembers.map(areaMember => this.mapAreaMember(areaMember));
  }

  async findAreaMembersByUser(userId: string) {
    const areaMembers = await this.prisma.area_member.findMany({
      where: { iduser: userId },
      include: {
        area: true,
        user: true,
      },
    });

    return areaMembers.map(areaMember => this.mapAreaMember(areaMember));
  }

  async deleteAreaMember(id: string, currentUser: User) {
    // Verificar permisos: solo super_admin y admin pueden eliminar miembros del área
    const userWithRoles = await this.userService.findByIdWithRoles(currentUser.id);
    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    if (userSystemRole === 'super_admin') {
      // Super admin puede eliminar miembros de cualquier área
    } else if (userSystemRole === 'area_role') {
      // area_role puede eliminar miembros solo si es admin (no area_member)
      const isAdmin = await this.prisma.admin.findFirst({
        where: { iduser: currentUser.id }
      });

      if (!isAdmin) {
        throw new ForbiddenException('Solo los admins pueden eliminar usuarios del área');
      }

      // Verificar que el admin puede eliminar miembros de esta área específica
      const areaMember = await this.prisma.area_member.findUnique({
        where: { id },
        include: { area: true }
      });

      if (!areaMember) {
        throw new NotFoundException('Miembro del área no encontrado');
      }

      const adminArea = await this.prisma.admin.findFirst({
        where: {
          iduser: currentUser.id,
          idarea: areaMember.idarea
        }
      });

      if (!adminArea) {
        throw new ForbiddenException('Solo puedes eliminar usuarios de las áreas que administras');
      }
    } else {
      throw new ForbiddenException('No tienes permisos para eliminar usuarios del área');
    }

    const areaMember = await this.prisma.area_member.findUnique({
      where: { id },
    });

    if (!areaMember) {
      throw new NotFoundException('Miembro del área no encontrado');
    }

    await this.prisma.area_member.delete({
      where: { id },
    });

    // Recalcular automáticamente el system_role basado en membresías restantes
    if (areaMember.iduser) {
      await this.promoteUserSystemRole(areaMember.iduser);
    }

    return true;
  }

  async getAreaAdmins(areaId: number) {
    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }

    // Obtener los administradores del área
    const admins = await this.prisma.admin.findMany({
      where: { idarea: areaId },
      include: {
        user: true,
        area: true,
      },
    });

    return admins.map(admin => ({
      id: admin.id,
      areaId: admin.idarea,
      userId: admin.iduser,
      area: admin.area,
      user: admin.user,
    }));
  }

  // ==================== CATEGORY MANAGEMENT FOR AREA_MEMBER ====================

  async getCategoriesAsAreaMember(userId: string): Promise<any[]> {
    // Verificar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    // Verificar si es super_admin (solo para este caso especial)
    const userWithRoles = await this.userService.findByIdWithRoles(userId);
    const userSystemRole = userWithRoles?.systemRole?.role?.name;

    // Super admin puede ver todas las categorías del sistema
    if (userSystemRole === 'super_admin') {
      const categories = await this.prisma.category.findMany({
        include: {
          area: true,
          project: true,
        },
      });

      return categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description || undefined,
        areaId: category.id_area,
        area: category.area ? {
          id: category.area.id,
          name: category.area.name || undefined,
        } : undefined,
        createdAt: undefined,
        updatedAt: undefined,
      }));
    }

    // Consultar DIRECTAMENTE las tablas admin y area_member (sin depender del sistema de roles)
    const adminAreas = await this.prisma.admin.findMany({
      where: { iduser: userId },
      select: { idarea: true }
    });

    const areaMemberAreas = await this.prisma.area_member.findMany({
      where: { iduser: userId },
      select: { idarea: true }
    });

    // Combinar todas las áreas y eliminar duplicados
    const adminAreaIds = adminAreas.map(admin => admin.idarea).filter((id): id is number => id !== null);
    const memberAreaIds = areaMemberAreas.map(member => member.idarea).filter((id): id is number => id !== null);
    const allAreaIds = [...new Set([...adminAreaIds, ...memberAreaIds])];

    if (allAreaIds.length === 0) {
      throw new ForbiddenException('Usuario no asignado a ningún área');
    }

    // Obtener categorías de TODAS las áreas donde tiene permisos
    const categories = await this.prisma.category.findMany({
      where: { id_area: { in: allAreaIds } },
      include: {
        area: true,
        project: true,
      },
    });

    return categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name || undefined,
      } : undefined,
      createdAt: undefined,
      updatedAt: undefined,
    }));
  }

  async createCategoryAsAreaMember(createCategoryInput: CreateCategoryInput, userId: string): Promise<any> {
    // Obtener información del usuario con roles
    const userWithRoles = await this.userService.findByIdWithRoles(userId);

    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    // Super admin puede crear categorías en cualquier área
    if (userSystemRole === 'super_admin') {
      // Verificar que el área existe
      const area = await this.prisma.area.findUnique({
        where: { id: createCategoryInput.areaId }
      });

      if (!area) {
        throw new BadRequestException('El área especificada no existe');
      }
    } else if (userSystemRole === 'area_role') {
      // area_role puede crear categorías solo en sus áreas asignadas (admin o miembro)
      const adminAreas = await this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      });

      const memberAreas = await this.prisma.area_member.findMany({
        where: { iduser: userId },
        select: { idarea: true },
      });

      // Combinar todas las áreas en las que participa
      const allAreas = new Set([
        ...adminAreas.map(a => a.idarea),
        ...memberAreas.map(m => m.idarea),
      ]);

      if (allAreas.size === 0) {
        throw new ForbiddenException('Usuario no asignado a ninguna área');
      }

      // Verificar que el área donde intenta crear la categoría esté dentro de sus áreas
      if (!allAreas.has(createCategoryInput.areaId)) {
        throw new ForbiddenException(
          'Solo puedes crear categorías en las áreas donde eres admin o miembro'
        );
      }
    } else {
      // Otros roles no pueden crear categorías
      throw new ForbiddenException('No tienes permisos para crear categorías');
    }

    // Verificar que el área existe (solo si no es super_admin, ya que ellos ya verificaron)
    if (userSystemRole !== 'super_admin') {
      const area = await this.prisma.area.findUnique({
        where: { id: createCategoryInput.areaId }
      });

      if (!area) {
        throw new BadRequestException('El área especificada no existe');
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: createCategoryInput.name,
        description: createCategoryInput.description,
        id_area: createCategoryInput.areaId,
      },
      include: {
        area: true,
      },
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name || undefined,
      } : undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }

  async updateCategoryAsAreaMember(updateCategoryInput: UpdateCategoryInput, userId: string): Promise<any> {
    // Obtener información del usuario con roles
    const userWithRoles = await this.userService.findByIdWithRoles(userId);

    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    // Verificar que la categoría existe
    const existingCategory = await this.prisma.category.findUnique({
      where: { id: updateCategoryInput.id },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Categoría con ID ${updateCategoryInput.id} no encontrada`);
    }

    // Verificar permisos según jerarquía
    if (userSystemRole === 'super_admin') {
      // Super admin puede actualizar cualquier categoría
    } else if (userSystemRole === 'area_role') {
      // Admin puede actualizar categorías solo en sus áreas asignadas
      const adminAreas = await this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true }
      });

      if (adminAreas.length === 0) {
        throw new ForbiddenException('Admin no asignado a ningún área');
      }

      const areaIds = adminAreas.map(admin => admin.idarea);

      if (!areaIds.includes(existingCategory.id_area)) {
        throw new ForbiddenException('Solo puedes actualizar categorías en las áreas donde eres admin');
      }

      // Si admin intenta mover categoría a otra área, verificar que tenga permisos en esa área también
      if (updateCategoryInput.areaId && updateCategoryInput.areaId !== existingCategory.id_area) {
        if (!areaIds.includes(updateCategoryInput.areaId)) {
          throw new ForbiddenException('No puedes mover categorías a áreas donde no eres admin');
        }
      }
    } else {
      // Area member puede actualizar categorías solo en su área
      const areaMember = await this.prisma.area_member.findFirst({
        where: { iduser: userId },
      });

      if (!areaMember) {
        throw new ForbiddenException('Usuario no asignado a ningún área como miembro');
      }

      if (existingCategory.id_area !== areaMember.idarea) {
        throw new ForbiddenException('Solo puedes actualizar categorías de tu área asignada');
      }

      if (updateCategoryInput.areaId && updateCategoryInput.areaId !== areaMember.idarea) {
        throw new ForbiddenException('No puedes mover categorías a otras áreas');
      }
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
      },
    });

    return {
      id: category.id,
      name: category.name,
      description: category.description || undefined,
      areaId: category.id_area,
      area: category.area ? {
        id: category.area.id,
        name: category.area.name || undefined,
      } : undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }

  async deleteCategoryAsAreaMember(categoryId: string, userId: string): Promise<boolean> {
    // Obtener información del usuario con roles
    const userWithRoles = await this.userService.findByIdWithRoles(userId);

    if (!userWithRoles) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userSystemRole = userWithRoles.systemRole?.role?.name;

    // Verificar que la categoría existe
    const existingCategory = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        project: true,
      },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Categoría con ID ${categoryId} no encontrada`);
    }

    // Verificar permisos según jerarquía
    if (userSystemRole === 'super_admin') {
      // Super admin puede eliminar cualquier categoría
    } else if (userSystemRole === 'area_role') {
      // Admin puede eliminar categorías solo en sus áreas asignadas
      const adminAreas = await this.prisma.admin.findMany({
        where: { iduser: userId },
        select: { idarea: true }
      });

      if (adminAreas.length === 0) {
        throw new ForbiddenException('Admin no asignado a ningún área');
      }

      const areaIds = adminAreas.map(admin => admin.idarea);

      if (!areaIds.includes(existingCategory.id_area)) {
        throw new ForbiddenException('Solo puedes eliminar categorías en las áreas donde eres admin');
      }
    } else {
      // Area member puede eliminar categorías solo en su área
      const areaMember = await this.prisma.area_member.findFirst({
        where: { iduser: userId },
      });

      if (!areaMember) {
        throw new ForbiddenException('Usuario no asignado a ningún área como miembro');
      }

      if (existingCategory.id_area !== areaMember.idarea) {
        throw new ForbiddenException('Solo puedes eliminar categorías de tu área asignada');
      }
    }

    // Verificar que no tenga proyectos asociados
    if (existingCategory.project.length > 0) {
      throw new BadRequestException('No se puede eliminar la categoría porque tiene proyectos asociados');
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return true;
  }

  async getAreaMembers(areaId: number) {
    // Verificar que el área existe
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
    });

    if (!area) {
      throw new NotFoundException('Área no encontrada');
    }

    // Obtener los area_members del área
    const areaMembers = await this.prisma.area_member.findMany({
      where: { idarea: areaId },
      include: {
        user: true,
        area: true,
      },
    });

    return areaMembers.map(areaMember => this.mapAreaMember(areaMember));
  }

  // ==================== HELPER METHODS FOR ROLE PROMOTION ====================

  private async promoteUserSystemRole(userId: string): Promise<void> {
    // Verificar membresías del usuario para determinar el rol más alto
    const userMemberships = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        admin: true,
        area_member: true,
        unit_member: true,
        system_role: {
          include: { role: true }
        }
      }
    });

    if (!userMemberships) return;

    let targetRoleName = 'user'; // Rol por defecto

    // Verificar el rol actual
    const currentRoleName = userMemberships.system_role?.role?.name;

    // Si ya es super_admin, NUNCA degradar (es el nivel más alto)
    if (currentRoleName === 'super_admin') {
      return; // Mantener super_admin siempre
    }

    // Determinar el rol más alto basado en membresías (jerarquía descendente)
    if (userMemberships.admin.length > 0 || userMemberships.area_member.length > 0) {
      targetRoleName = 'area_role';
    } else if (userMemberships.unit_member.length > 0) {
      targetRoleName = 'unit_role';
    }

    // Verificar si ya tiene el rol correcto
    if (currentRoleName === targetRoleName) {
      return; // Ya tiene el rol correcto
    }

    // Buscar el rol objetivo
    const targetRole = await this.prisma.role.findFirst({
      where: { name: targetRoleName }
    });

    if (!targetRole) {
      console.error(`Rol ${targetRoleName} no encontrado en el sistema`);
      return;
    }

    // Actualizar o crear system_role
    await this.prisma.system_role.upsert({
      where: { user_id: userId },
      update: { role_id: targetRole.id },
      create: {
        user_id: userId,
        role_id: targetRole.id
      }
    });

    console.log(`✅ Usuario ${userId} promovido automáticamente a system_role: ${targetRoleName}`);
  }
}
