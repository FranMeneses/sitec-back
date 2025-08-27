import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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

  async createUser(data: {
    name: string;
    email: string;
    password?: string;
    havePassword?: boolean;
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

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async isValidUCNEmail(email: string): Promise<boolean> {
    const validDomains = ['@alumno.ucn.cl', '@ce.ucn.cl', '@ucn.cl'];
    return validDomains.some(domain => email.endsWith(domain));
  }
}
