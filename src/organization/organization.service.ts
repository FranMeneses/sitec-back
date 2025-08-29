import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAreaInput, UpdateAreaInput } from './dto/area.dto';
import { CreateUnitInput, UpdateUnitInput } from './dto/unit.dto';
import { CreateUnitMemberInput, UpdateUnitMemberInput } from './dto/unit-member.dto';
import { CreateTypeInput, UpdateTypeInput } from './dto/type.dto';
import { CreateAdminInput } from './dto/admin.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  // ===== AREA METHODS =====
  async createArea(createAreaInput: CreateAreaInput, currentUser: User) {
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden crear áreas');
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

  async findAllAreas() {
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
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden actualizar áreas');
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
    // Verificar si el usuario es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar áreas');
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

    return this.prisma.unit.create({
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
  }

  async findAllUnits() {
    return this.prisma.unit.findMany({
      include: {
        type: true,
        project: true,
        unit_member: true,
      },
    });
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
    // Verificar si el usuario es admin de la unidad
    const isUnitAdmin = await this.isUserUnitAdmin(currentUser.id, createUnitMemberInput.idunit);
    if (!isUnitAdmin) {
      throw new ForbiddenException('Solo los administradores de la unidad pueden agregar miembros');
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
    // Verificar si el usuario es admin de la unidad
    const member = await this.prisma.unit_member.findUnique({
      where: { id: updateUnitMemberInput.id },
    });

    if (!member) {
      throw new NotFoundException(`Miembro de unidad con ID ${updateUnitMemberInput.id} no encontrado`);
    }

    if (!member.idunit) {
      throw new NotFoundException('El miembro no está asignado a ninguna unidad');
    }

    const isUnitAdmin = await this.isUserUnitAdmin(currentUser.id, member.idunit);
    if (!isUnitAdmin) {
      throw new ForbiddenException('Solo los administradores de la unidad pueden actualizar miembros');
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
    const member = await this.prisma.unit_member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Miembro de unidad con ID ${id} no encontrado`);
    }

    // Verificar si el usuario es admin de la unidad
    if (!member.idunit) {
      throw new NotFoundException('El miembro no está asignado a ninguna unidad');
    }

    const isUnitAdmin = await this.isUserUnitAdmin(currentUser.id, member.idunit);
    if (!isUnitAdmin) {
      throw new ForbiddenException('Solo los administradores de la unidad pueden eliminar miembros');
    }

    return this.prisma.unit_member.delete({
      where: { id },
    });
  }

  async findUnitMembers(unitId: number) {
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
  async findAllTypes() {
    return this.prisma.type.findMany();
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
    // Verificar si el usuario actual es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden crear otros administradores');
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
    // Verificar si el usuario actual es admin
    const isAdmin = await this.isUserAdmin(currentUser.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden eliminar otros administradores');
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

    return `Administrador con ID ${id} eliminado exitosamente`;
  }
}
