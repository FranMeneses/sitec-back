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

      // Verificar que no hay usuarios asignados a este rol
      const usersWithRole = await this.prisma.unit_member.findMany({
        where: { idrole: id },
      });

      const projectMembersWithRole = await this.prisma.project_member.findMany({
        where: { idrole: id },
      });

      if (usersWithRole.length > 0 || projectMembersWithRole.length > 0) {
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
    // Obtener roles del usuario a través de unit_member
    const unitMemberships = await this.prisma.unit_member.findMany({
      where: { iduser: userId },
      include: { role: true },
    });

    // Obtener roles del usuario a través de project_member
    const projectMemberships = await this.prisma.project_member.findMany({
      where: { iduser: userId },
      include: { role: true },
    });

    // Combinar y deduplicar roles
    const allRoles = [
      ...unitMemberships.filter(um => um.role).map(um => um.role!),
      ...projectMemberships.filter(pm => pm.role).map(pm => pm.role!),
    ];

    // Eliminar duplicados basado en ID
    const uniqueRoles = allRoles.filter((role, index, self) => 
      index === self.findIndex(r => r.id === role.id)
    );

    return uniqueRoles.map(role => ({
      id: role.id,
      name: role.name || '',
      description: undefined,
    }));
  }
}
