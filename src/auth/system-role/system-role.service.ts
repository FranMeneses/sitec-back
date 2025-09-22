import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SystemRoleService {
  constructor(private prisma: PrismaService) {}

  async assignDefaultRole(userId: string): Promise<void> {
    // Buscar el rol "user" en la tabla role
    const userRole = await this.prisma.role.findFirst({
      where: { name: 'user' }
    });

    if (!userRole) {
      throw new Error('Rol "user" no encontrado. Asegúrate de que exista en la base de datos.');
    }

    // Crear el system_role para el usuario
    await this.prisma.system_role.create({
      data: {
        user_id: userId,
        role_id: userRole.id,
      }
    });
  }

  async getUserSystemRole(userId: string): Promise<any> {
    const systemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: {
        role: true
      }
    });

    return systemRole;
  }

  async updateUserSystemRole(userId: string, roleId: number): Promise<void> {
    // Verificar si el usuario ya tiene un system_role
    const existingSystemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId }
    });

    if (existingSystemRole) {
      // Actualizar el rol existente
      await this.prisma.system_role.update({
        where: { user_id: userId },
        data: { role_id: roleId }
      });
    } else {
      // Crear un nuevo system_role
      await this.prisma.system_role.create({
        data: {
          user_id: userId,
          role_id: roleId
        }
      });
    }
  }

  async removeUserSystemRole(userId: string): Promise<void> {
    await this.prisma.system_role.delete({
      where: { user_id: userId }
    });
  }

  async getAllSystemRoles(): Promise<any[]> {
    const systemRoles = await this.prisma.system_role.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isactive: true,
            admin: {
              include: {
                area: true
              }
            }
          }
        },
        role: true
      }
    });

    return systemRoles.map(sr => ({
      id: sr.user.id,
      name: sr.user.name,
      email: sr.user.email,
      isActive: sr.user.isactive,
      role: sr.role,
      areaName: sr.user.admin && sr.user.admin.length > 0 && sr.user.admin[0].area ? 
        sr.user.admin[0].area.name : null,
      areaId: sr.user.admin && sr.user.admin.length > 0 ? 
        sr.user.admin[0].idarea : null
    }));
  }


  async assignUserToAreaAsAdmin(userId: string, adminUserId: string, targetAreaId?: number): Promise<void> {
    let areaId: number;

    // Verificar si el usuario actual es super_admin
    const currentUserRole = await this.prisma.system_role.findUnique({
      where: { user_id: adminUserId },
      include: { role: true }
    });

    const isSuperAdmin = currentUserRole?.role?.name === 'super_admin';

    if (isSuperAdmin && targetAreaId) {
      // Super_admin puede asignar a cualquier área
      areaId = targetAreaId;
    } else {
      // Admin regular solo puede asignar a su propia área
      const adminRecord = await this.prisma.admin.findFirst({
        where: { iduser: adminUserId },
        select: { idarea: true }
      });

      if (!adminRecord) {
        throw new Error('Admin no está asociado a ningún área');
      }
      areaId = adminRecord.idarea!;
    }

    // Verificar que el usuario existe y no está ya asignado al área
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { admin: true }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const existingAdmin = user.admin.find(admin => admin.idarea === areaId);
    if (existingAdmin) {
      throw new Error('El usuario ya es admin de esta área');
    }

    // Crear entrada en tabla admin
    await this.prisma.admin.create({
      data: {
        idarea: areaId,
        iduser: userId
      }
    });

    // Solo actualizar system_role a admin si el usuario NO es super_admin
    const userRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true }
    });

    const isUserSuperAdmin = userRole?.role?.name === 'super_admin';

    if (!isUserSuperAdmin) {
      // Solo cambiar a admin si no es super_admin
      const adminRole = await this.prisma.role.findFirst({
        where: { name: 'admin' }
      });

      if (adminRole) {
        await this.updateUserSystemRole(userId, adminRole.id);
      }
    }
    // Si es super_admin, mantiene su system_role pero se agrega a la tabla admin
  }

  async assignUserToAreaAsMember(userId: string, adminUserId: string, targetAreaId?: number): Promise<void> {
    let areaId: number;

    // Verificar si el usuario actual es super_admin
    const currentUserRole = await this.prisma.system_role.findUnique({
      where: { user_id: adminUserId },
      include: { role: true }
    });

    const isSuperAdmin = currentUserRole?.role?.name === 'super_admin';

    if (isSuperAdmin && targetAreaId) {
      // Super_admin puede asignar a cualquier área
      areaId = targetAreaId;
    } else {
      // Admin regular solo puede asignar a su propia área
      const adminRecord = await this.prisma.admin.findFirst({
        where: { iduser: adminUserId },
        select: { idarea: true }
      });

      if (!adminRecord) {
        throw new Error('Admin no está asociado a ningún área');
      }
      areaId = adminRecord.idarea!;
    }

    // Verificar que el usuario existe y no está ya asignado al área
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { area_member: true }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const existingMember = user.area_member.find(member => member.idarea === areaId);
    if (existingMember) {
      throw new Error('El usuario ya es miembro de esta área');
    }

    // Crear entrada en tabla area_member
    await this.prisma.area_member.create({
      data: {
        idarea: areaId,
        iduser: userId
      }
    });

    // El system_role se mantiene como está:
    // - Si es 'super_admin' → se mantiene como 'super_admin'
    // - Si es 'user' → se mantiene como 'user'
    // - Si es 'admin' → se mantiene como 'admin'
    // No modificamos el system_role para area_member
  }
}
