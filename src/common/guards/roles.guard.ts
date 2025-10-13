import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requireAdminMembership = this.reflector.getAllAndOverride<boolean>('REQUIRE_ADMIN_MEMBERSHIP', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles requeridos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener el contexto de GraphQL
    const gqlContext = GqlExecutionContext.create(context);
    const { user } = gqlContext.getContext().req;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Verificar si el usuario tiene al menos uno de los roles requeridos
    const hasRequiredRole = requiredRoles.some(role => {
      // Verificar roles del usuario desde la base de datos
      if (user.roles && Array.isArray(user.roles)) {
        return user.roles.some(userRole => userRole.name === role);
      }
      
      return false;
    });

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    // Si se requiere verificación de membresía de admin
    if (requireAdminMembership) {
      const isAdmin = await this.prisma.admin.findFirst({
        where: { iduser: user.id }
      });

      if (!isAdmin) {
        throw new ForbiddenException('Acceso denegado. Se requiere membresía de administrador');
      }
    }

    return true;
  }
}
