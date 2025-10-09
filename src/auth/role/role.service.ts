import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../entities/role.entity';
import { CreateRoleInput, UpdateRoleInput } from '../dto/role.dto';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name || '',
      description: undefined, // No hay description en el schema actual
    }));
  }

  async findById(id: number): Promise<Role | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name || '',
      description: undefined,
    };
  }

  async findByName(name: string): Promise<Role | null> {
    const role = await this.prisma.role.findFirst({
      where: { name },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name || '',
      description: undefined,
    };
  }

  async create(createRoleInput: CreateRoleInput): Promise<Role> {
    // Verificar que el nombre no exista
    const existingRole = await this.findByName(createRoleInput.name);
    if (existingRole) {
      throw new BadRequestException(`El rol '${createRoleInput.name}' ya existe`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: createRoleInput.name,
      },
    });

    return {
      id: role.id,
      name: role.name || '',
      description: createRoleInput.description,
    };
  }

  async update(updateRoleInput: UpdateRoleInput): Promise<Role> {
    const existingRole = await this.findById(updateRoleInput.id);
    if (!existingRole) {
      throw new NotFoundException(`Rol con ID ${updateRoleInput.id} no encontrado`);
    }

    // Si se actualiza el nombre, verificar que no exista
    if (updateRoleInput.name && updateRoleInput.name !== existingRole.name) {
      const roleWithSameName = await this.findByName(updateRoleInput.name);
      if (roleWithSameName) {
        throw new BadRequestException(`El rol '${updateRoleInput.name}' ya existe`);
      }
    }

    const updateData: any = {};
    if (updateRoleInput.name) updateData.name = updateRoleInput.name;

    const role = await this.prisma.role.update({
      where: { id: updateRoleInput.id },
      data: updateData,
    });

    return {
      id: role.id,
      name: role.name || '',
      description: updateRoleInput.description,
    };
  }

  async delete(id: number): Promise<boolean> {
    try {
      // Verificar que el rol existe
      const existingRole = await this.findById(id);
      if (!existingRole) {
        throw new NotFoundException(`Rol con ID ${id} no encontrado`);
      }

      // Verificar que no hay usuarios asignados a este rol del sistema
      const systemRolesWithRole = await this.prisma.system_role.findMany({
        where: { role_id: id },
      });

      if (systemRolesWithRole.length > 0) {
        throw new BadRequestException('No se puede eliminar el rol porque tiene usuarios asignados');
      }

      await this.prisma.role.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al eliminar el rol');
    }
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    // Obtener el rol del sistema del usuario
    const systemRole = await this.prisma.system_role.findUnique({
      where: { user_id: userId },
      include: { role: true },
    });

    if (!systemRole || !systemRole.role) {
      return [];
    }

    return [{
      id: systemRole.role.id,
      name: systemRole.role.name || '',
      description: undefined,
    }];
  }
}
