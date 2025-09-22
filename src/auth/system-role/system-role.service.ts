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
}
