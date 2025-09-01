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
        }
      }
    });
    
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name || '',
      email: user.email,
      password: user.password || undefined,
      isActive: user.isactive ?? true,
      havePassword: user.havepassword ?? false,
      roles: user.system_role ? [user.system_role.role] : []
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

  async initializeDefaultRoles(): Promise<void> {
    const defaultRoles = [
      'super_admin',
      'admin',
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
}
