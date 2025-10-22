import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from './email.service';
import { CreateInvitationInput, AcceptInvitationInput, InvitationResponse, InvitationListResponse, RoleType, InvitationStatus } from './dto/invitation.dto';
import { UserService } from '../auth/user/user.service';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private userService: UserService,
  ) {}

  async createInvitation(
    createInvitationInput: CreateInvitationInput,
    inviterId: string,
  ): Promise<InvitationResponse> {
    try {
      // Verificar que el proyecto existe
      const project = await this.prisma.project.findUnique({
        where: { id: createInvitationInput.projectId },
        include: { user: true }, // editor del proyecto
      });

      if (!project) {
        throw new NotFoundException('Proyecto no encontrado');
      }

      // Verificar que el usuario invitador tiene permisos para invitar a este proyecto
      const canInvite = await this.canUserInviteToProject(inviterId, createInvitationInput.projectId);
      if (!canInvite) {
        throw new BadRequestException('No tienes permisos para invitar usuarios a este proyecto');
      }

      // Verificar que no existe una invitación pendiente para este email y proyecto
      const existingInvitation = await this.prisma.invitation.findFirst({
        where: {
          email: createInvitationInput.email,
          project_id: createInvitationInput.projectId,
          status: InvitationStatus.PENDING,
        },
      });

      if (existingInvitation) {
        throw new BadRequestException('Ya existe una invitación pendiente para este email en este proyecto');
      }

      // Generar token único
      const token = crypto.randomBytes(32).toString('hex');
      
      // Fecha de expiración (7 días)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Crear la invitación
      const invitation = await this.prisma.invitation.create({
        data: {
          email: createInvitationInput.email,
          token,
          project_id: createInvitationInput.projectId,
          invited_by: inviterId,
          role_type: createInvitationInput.roleType,
          status: InvitationStatus.PENDING,
          expires_at: expiresAt,
        },
        include: {
          project: true,
          user_invitation_invited_byTouser: true,
        },
      });

      // Obtener información del invitador
      const inviter = await this.userService.findById(inviterId);
      if (!inviter) {
        throw new NotFoundException('Usuario invitador no encontrado');
      }

      // Enviar email de invitación
      await this.emailService.sendInvitationEmail(
        createInvitationInput.email,
        inviter.name,
        project.name || 'Proyecto sin nombre',
        token,
      );

      return {
        success: true,
        message: 'Invitación enviada exitosamente',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.token,
          projectId: invitation.project_id,
          invitedBy: invitation.invited_by,
          roleType: invitation.role_type,
          status: invitation.status || 'pending',
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at || undefined,
          inviter: {
            id: inviter.id,
            name: inviter.name,
            email: inviter.email,
            isActive: inviter.isActive,
            havePassword: inviter.havePassword,
          },
        },
      };
    } catch (error) {
      console.error('Error creando invitación:', error);
      throw error;
    }
  }

  async acceptInvitation(acceptInvitationInput: AcceptInvitationInput): Promise<InvitationResponse> {
    try {
      // Buscar la invitación por token
      const invitation = await this.prisma.invitation.findUnique({
        where: { token: acceptInvitationInput.token },
        include: {
          project: true,
          user_invitation_invited_byTouser: true,
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada');
      }

      // Verificar que la invitación no haya expirado
      if (new Date() > invitation.expires_at) {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new BadRequestException('La invitación ha expirado');
      }

      // Verificar que la invitación esté pendiente
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('La invitación ya fue procesada');
      }

      return {
        success: true,
        message: 'Invitación válida',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          token: invitation.token,
          projectId: invitation.project_id,
          invitedBy: invitation.invited_by,
          roleType: invitation.role_type,
          status: invitation.status || 'pending',
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at || undefined,
          inviter: invitation.user_invitation_invited_byTouser ? {
            id: invitation.user_invitation_invited_byTouser.id,
            name: invitation.user_invitation_invited_byTouser.name || '',
            email: invitation.user_invitation_invited_byTouser.email,
            isActive: invitation.user_invitation_invited_byTouser.isactive ?? true,
            havePassword: invitation.user_invitation_invited_byTouser.havepassword ?? false,
          } : undefined,
        },
      };
    } catch (error) {
      console.error('Error validando invitación:', error);
      throw error;
    }
  }

  async processInvitationAcceptance(
    token: string,
    accepterId: string,
  ): Promise<InvitationResponse> {
    try {
      // Buscar la invitación
      const invitation = await this.prisma.invitation.findUnique({
        where: { token },
        include: {
          project: true,
          user_invitation_invited_byTouser: true,
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada');
      }

      // Verificar que la invitación esté pendiente
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('La invitación ya fue procesada');
      }

      // Verificar que no haya expirado
      if (new Date() > invitation.expires_at) {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
        throw new BadRequestException('La invitación ha expirado');
      }

      // Asignar al usuario al proyecto según el tipo de rol
      if (invitation.role_type === RoleType.PROJECT_MEMBER) {
        await this.prisma.project_member.create({
          data: {
            idproject: invitation.project_id,
            iduser: accepterId,
          },
        });
      } else if (invitation.role_type === RoleType.TASK_MEMBER) {
        // Para task_member, necesitaríamos el ID de la tarea específica
        // Por ahora, lo asignamos como project_member también
        await this.prisma.project_member.create({
          data: {
            idproject: invitation.project_id,
            iduser: accepterId,
          },
        });
      }

      // Marcar la invitación como aceptada
      const updatedInvitation = await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          accepted_at: new Date(),
          accepted_by: accepterId,
        },
        include: {
          project: true,
          user_invitation_invited_byTouser: true,
        },
      });

      // Enviar notificación al invitador
      const accepter = await this.userService.findById(accepterId);
      if (accepter && invitation.user_invitation_invited_byTouser) {
        await this.emailService.sendInvitationAcceptedEmail(
          invitation.user_invitation_invited_byTouser.email,
          accepter.name,
          invitation.project.name || 'Proyecto sin nombre',
        );
      }

      return {
        success: true,
        message: 'Invitación aceptada exitosamente',
        invitation: {
          id: updatedInvitation.id,
          email: updatedInvitation.email,
          token: updatedInvitation.token,
          projectId: updatedInvitation.project_id,
          invitedBy: updatedInvitation.invited_by,
          roleType: updatedInvitation.role_type,
          status: updatedInvitation.status || 'pending',
          expiresAt: updatedInvitation.expires_at,
          createdAt: updatedInvitation.created_at || undefined,
          acceptedAt: updatedInvitation.accepted_at || undefined,
          acceptedBy: updatedInvitation.accepted_by || undefined,
        },
      };
    } catch (error) {
      console.error('Error procesando aceptación de invitación:', error);
      throw error;
    }
  }

  async getInvitationsByProject(projectId: string): Promise<InvitationListResponse> {
    const invitations = await this.prisma.invitation.findMany({
      where: { project_id: projectId },
      include: {
        user_invitation_invited_byTouser: true,
        user_invitation_accepted_byTouser: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        token: inv.token,
        projectId: inv.project_id,
        invitedBy: inv.invited_by,
        roleType: inv.role_type,
        status: inv.status || 'pending',
        expiresAt: inv.expires_at,
        createdAt: inv.created_at || undefined,
        acceptedAt: inv.accepted_at || undefined,
        acceptedBy: inv.accepted_by || undefined,
        inviter: inv.user_invitation_invited_byTouser ? {
          id: inv.user_invitation_invited_byTouser.id,
          name: inv.user_invitation_invited_byTouser.name || '',
          email: inv.user_invitation_invited_byTouser.email,
          isActive: inv.user_invitation_invited_byTouser.isactive ?? true,
          havePassword: inv.user_invitation_invited_byTouser.havepassword ?? false,
        } : undefined,
        accepter: inv.user_invitation_accepted_byTouser ? {
          id: inv.user_invitation_accepted_byTouser.id,
          name: inv.user_invitation_accepted_byTouser.name || '',
          email: inv.user_invitation_accepted_byTouser.email,
          isActive: inv.user_invitation_accepted_byTouser.isactive ?? true,
          havePassword: inv.user_invitation_accepted_byTouser.havepassword ?? false,
        } : undefined,
      })),
      total: invitations.length,
    };
  }

  async cancelInvitation(invitationId: string, userId: string): Promise<InvitationResponse> {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada');
      }

      // Verificar que el usuario tiene permisos para cancelar esta invitación
      if (invitation.invited_by !== userId) {
        throw new BadRequestException('No tienes permisos para cancelar esta invitación');
      }

      // Solo se pueden cancelar invitaciones pendientes
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException('Solo se pueden cancelar invitaciones pendientes');
      }

      await this.prisma.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.EXPIRED },
      });

      return {
        success: true,
        message: 'Invitación cancelada exitosamente',
      };
    } catch (error) {
      console.error('Error cancelando invitación:', error);
      throw error;
    }
  }

  async canUserInviteToProject(userId: string, projectId: string): Promise<boolean> {
    // Verificar si es super_admin
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return true;

    // Verificar si es admin del área del proyecto
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) {
      const adminArea = await this.userService.getAdminArea(userId);
      if (adminArea) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          include: { category: true },
        });
        if (project?.category?.id_area === adminArea) {
          return true;
        }
      }
    }

    // Verificar si es unit_member de la unidad del proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { idunit: true },
    });

    if (project?.idunit) {
      const isUnitMember = await this.userService.isUnitMember(userId, project.idunit);
      if (isUnitMember) return true;
    }

    // Verificar si es project_member del proyecto
    const isProjectMember = await this.userService.isProjectMember(userId, projectId);
    if (isProjectMember) return true;

    return false;
  }
}
