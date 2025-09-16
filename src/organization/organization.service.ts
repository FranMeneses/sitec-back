import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAreaInput, UpdateAreaInput } from './dto/area.dto';
import { CreateUnitInput, UpdateUnitInput } from './dto/unit.dto';
import { CreateUnitMemberInput, UpdateUnitMemberInput } from './dto/unit-member.dto';
import { CreateTypeInput, UpdateTypeInput } from './dto/type.dto';
import { CreateAdminInput, AssignSuperAdminInput } from './dto/admin.dto';
import { CreateAreaMemberInput } from './dto/area-member.dto';
import { SystemRoleService } from '../auth/system-role/system-role.service';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private systemRoleService: SystemRoleService,
  ) {}

  // ===== AREA METHODS =====
  async createArea(createAreaInput: CreateAreaInput, currentUser: User) {
    // Verificar si el usuario es super_admin (solo super_admin puede crear áreas)
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden crear áreas');
    }

    return this.prisma.area.create({
      data: {
        name: createAreaInput.name,
      },
      include: {
        admin: true,
        category: true,
      },
    });
  }

  async findAllAreas(currentUser?: User) {
    // Si no hay usuario, mostrar todas las áreas
    if (!currentUser) {
      return this.prisma.area.findMany({
        include: {
          admin: true,
          category: true,
        },
      });
    }

    // Verificar si el usuario es admin o super_admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    
    if (!isAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Solo los administradores pueden ver las áreas');
    }

    // Los admins pueden ver todas las áreas, pero solo interactuar con la suya
    return this.prisma.area.findMany({
      include: {
        admin: true,
        category: true,
      },
    });
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
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden crear unidades');
    }

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Verificar que el tipo de unidad existe
    if (createUnitInput.idtype) {
      const type = await this.prisma.type.findUnique({
        where: { id: createUnitInput.idtype }
      });

      if (!type) {
        throw new NotFoundException(`Tipo con ID ${createUnitInput.idtype} no encontrado`);
      }
    }

    // Crear la unidad
    const unit = await this.prisma.unit.create({
      data: {
        name: createUnitInput.name,
        idtype: createUnitInput.idtype,
      },
      include: {
        type: true,
        project: true,
        unit_member: true,
      },
    });

    // Asignar automáticamente al admin como unit_member de la nueva unidad
    // Buscar el rol de admin en unit_member (asumiendo que existe un rol "admin" o similar)
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'admin' }
    });

    if (adminRole) {
      await this.prisma.unit_member.create({
        data: {
          iduser: currentUser.id,
          idunit: unit.id,
          idrole: adminRole.id,
        },
      });
    }

    return unit;
  }

  async findAllUnits(currentUser?: User) {
    // Si no hay usuario, mostrar todas las unidades
    if (!currentUser) {
      return this.prisma.unit.findMany({
        include: {
          type: true,
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
          project: {
            include: {
              category: true
            }
          },
          unit_member: {
            include: {
              user: true,
              role: true
            }
          },
        },
      });
    }

    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      // Si no es admin, no puede ver unidades (solo admins pueden ver unidades)
      throw new ForbiddenException('Solo los administradores pueden ver las unidades');
    }

    // Si es admin, mostrar solo las unidades de su área
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Obtener unidades que tienen proyectos con categorías del área del admin
    // También incluir unidades donde el admin es unit_member
    const unitsInArea = await this.prisma.unit.findMany({
      where: {
        OR: [
          // Unidades que tienen proyectos con categorías del área del admin
          {
            project: {
              some: {
                category: {
                  id_area: adminArea
                }
              }
            }
          },
          // Unidades donde el admin es unit_member
          {
            unit_member: {
              some: {
                iduser: currentUser.id
              }
            }
          }
        ]
      },
      include: {
        type: true,
        project: {
          include: {
            category: true
          }
        },
        unit_member: {
          include: {
            user: true,
            role: true
          }
        },
      },
    });

    return unitsInArea;
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
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden actualizar unidades');
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
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar unidades');
    }

    await this.findUnitById(id);

    return this.prisma.unit.delete({
      where: { id },
    });
  }

  // ===== UNIT MEMBER METHODS =====
  async addUnitMember(createUnitMemberInput: CreateUnitMemberInput, currentUser: User) {
    // Verificar si el usuario es admin (de cualquier área)
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden agregar miembros a unidades');
    }

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

    // Verificar que la unidad esté en el área del admin
    const unit = await this.prisma.unit.findUnique({
      where: { id: createUnitMemberInput.idunit },
      include: {
        project: {
          include: {
            category: true
          }
        }
      }
    });

    if (!unit) {
      throw new NotFoundException(`Unidad con ID ${createUnitMemberInput.idunit} no encontrada`);
    }

    // Verificar que la unidad pertenezca a un proyecto de la categoría del área del admin
    const unitInAdminArea = unit.project.some(project => 
      project.category && project.category.id_area === adminArea
    );

    if (!unitInAdminArea) {
      throw new ForbiddenException('Solo puedes agregar miembros a unidades de tu área');
    }

    // Verificar que el usuario a agregar existe
    const userToAdd = await this.prisma.user.findUnique({
      where: { id: createUnitMemberInput.iduser }
    });

    if (!userToAdd) {
      throw new NotFoundException(`Usuario con ID ${createUnitMemberInput.iduser} no encontrado`);
    }

    // Verificar que el rol existe
    const role = await this.prisma.role.findUnique({
      where: { id: createUnitMemberInput.idrole }
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${createUnitMemberInput.idrole} no encontrado`);
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

    return this.prisma.unit_member.create({
      data: {
        iduser: createUnitMemberInput.iduser,
        idunit: createUnitMemberInput.idunit,
        idrole: createUnitMemberInput.idrole,
      },
      include: {
        user: true,
        unit: true,
        role: true,
      },
    });
  }

  async updateUnitMember(updateUnitMemberInput: UpdateUnitMemberInput, currentUser: User) {
    // Verificar si el usuario es admin (de cualquier área)
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden actualizar miembros de unidades');
    }

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

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

    // Verificar que la unidad esté en el área del admin
    if (!member.unit) {
      throw new NotFoundException('La unidad asociada al miembro no existe');
    }

    const unitInAdminArea = member.unit.project.some(project => 
      project.category && project.category.id_area === adminArea
    );

    if (!unitInAdminArea) {
      throw new ForbiddenException('Solo puedes actualizar miembros de unidades de tu área');
    }

    // Verificar que el usuario a actualizar existe
    if (updateUnitMemberInput.iduser) {
      const userToUpdate = await this.prisma.user.findUnique({
        where: { id: updateUnitMemberInput.iduser }
      });

      if (!userToUpdate) {
        throw new NotFoundException(`Usuario con ID ${updateUnitMemberInput.iduser} no encontrado`);
      }
    }

    // Verificar que el rol existe
    if (updateUnitMemberInput.idrole) {
      const role = await this.prisma.role.findUnique({
        where: { id: updateUnitMemberInput.idrole }
      });

      if (!role) {
        throw new NotFoundException(`Rol con ID ${updateUnitMemberInput.idrole} no encontrado`);
      }
    }

    return this.prisma.unit_member.update({
      where: { id: updateUnitMemberInput.id },
      data: {
        iduser: updateUnitMemberInput.iduser,
        idunit: updateUnitMemberInput.idunit,
        idrole: updateUnitMemberInput.idrole,
      },
      include: {
        user: true,
        unit: true,
        role: true,
      },
    });
  }

  async removeUnitMember(id: string, currentUser: User) {
    // Verificar si el usuario es admin (de cualquier área)
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar miembros de unidades');
    }

    // Obtener el área del admin
    const adminArea = await this.getAdminArea(currentUser.id);
    if (!adminArea) {
      throw new ForbiddenException('Admin no asociado a ningún área');
    }

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

    // Verificar que la unidad esté en el área del admin
    if (!member.unit) {
      throw new NotFoundException('La unidad asociada al miembro no existe');
    }

    const unitInAdminArea = member.unit.project.some(project => 
      project.category && project.category.id_area === adminArea
    );

    if (!unitInAdminArea) {
      throw new ForbiddenException('Solo puedes eliminar miembros de unidades de tu área');
    }

    return this.prisma.unit_member.delete({
      where: { id },
    });
  }

  async findUnitMembers(unitId: number, currentUser?: User) {
    // Si no hay usuario, mostrar todos los miembros
    if (!currentUser) {
      return this.prisma.unit_member.findMany({
        where: { idunit: unitId },
        include: {
          user: true,
          unit: true,
          role: true,
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
          role: true,
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
        role: true,
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
    // Verificar si es admin general
    const isAdmin = await this.isUserAdmin(userId);
    if (isAdmin) return true;

    // Verificar si es admin de la unidad específica
    const unitMember = await this.prisma.unit_member.findFirst({
      where: {
        iduser: userId,
        idunit: unitId,
        idrole: 1, // Asumiendo que el role ID 1 es admin
      },
    });

    return !!unitMember;
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
    // Verificar si el usuario actual es admin o super_admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    
    if (!isAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Solo los administradores y super administradores pueden crear otros administradores');
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

    // Actualizar el system_role del usuario a "admin"
    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'admin' }
    });

    if (adminRole) {
      await this.systemRoleService.updateUserSystemRole(createAdminInput.idUser, adminRole.id);
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

  async removeAdmin(id: string, currentUser: User): Promise<string> {
    // Verificar si el usuario actual es admin o super_admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    const isSuperAdmin = await this.isUserSuperAdmin(currentUser.id);
    
    if (!isAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Solo los administradores y super administradores pueden eliminar otros administradores');
    }

    // Verificar que el admin existe
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });
    if (!admin) {
      throw new NotFoundException(`Administrador con ID ${id} no encontrado`);
    }

    // Verificar que no se esté eliminando a sí mismo
    if (admin.iduser === currentUser.id) {
      throw new ForbiddenException('No puedes eliminar tu propio rol de administrador');
    }

    await this.prisma.admin.delete({
      where: { id },
    });

    // Verificar si el usuario tiene otros roles de admin en otras áreas
    const otherAdminRoles = await this.prisma.admin.findFirst({
      where: { iduser: admin.iduser }
    });

    // Si no tiene otros roles de admin, revertir su system_role a "user"
    if (!otherAdminRoles && admin.iduser) {
      const userRole = await this.prisma.role.findFirst({
        where: { name: 'user' }
      });

      if (userRole) {
        await this.systemRoleService.updateUserSystemRole(admin.iduser, userRole.id);
      }
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
    // Obtener el área del admin
    const adminRecord = await this.prisma.admin.findFirst({
      where: { iduser: userId },
      select: { idarea: true }
    });

    return adminRecord?.idarea || null;
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
        throw new ForbiddenException('Solo puedes ver usuarios disponibles para unidades de tu área');
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

  async createAreaMember(createAreaMemberInput: CreateAreaMemberInput) {
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

  async deleteAreaMember(id: string) {
    const areaMember = await this.prisma.area_member.findUnique({
      where: { id },
    });

    if (!areaMember) {
      throw new NotFoundException('Miembro del área no encontrado');
    }

    await this.prisma.area_member.delete({
      where: { id },
    });

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
}
