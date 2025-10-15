import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Notification } from './entities/notification.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { NotificationFilterInput } from './dto/notification-filter.input';
import { MarkNotificationReadInput } from './dto/mark-notification-read.input';
import { NotificationType } from './dto/create-notification.input';
import { buildNotificationTexts } from './constants/notification-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD METHODS ====================

  async createNotification(createNotificationInput: CreateNotificationInput): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        user_id: createNotificationInput.userId,
        type: createNotificationInput.type,
        title: createNotificationInput.title,
        message: createNotificationInput.message,
        related_project_id: createNotificationInput.relatedProjectId,
        related_process_id: createNotificationInput.relatedProcessId,
        related_task_id: createNotificationInput.relatedTaskId,
        created_at: new Date(),
      },
      include: {
        user: true,
        project: true,
        process: true,
        task: true,
      },
    });

    return this.mapNotification(notification);
  }

  // Método helper para crear notificación desde plantilla
  async createFromTemplate(
    userId: string,
    type: NotificationType,
    vars: Record<string, any> = {},
    related?: { projectId?: string; processId?: string; taskId?: string },
    overrides?: { title?: string; message?: string }
  ): Promise<Notification> {
    const { title, message } = buildNotificationTexts(type, vars, overrides);
    return this.createNotification({
      userId,
      type,
      title,
      message,
      relatedProjectId: related?.projectId,
      relatedProcessId: related?.processId,
      relatedTaskId: related?.taskId,
    });
  }

  async getNotifications(filter: NotificationFilterInput): Promise<Notification[]> {
    const where: any = {};

    if (filter.userId) where.user_id = filter.userId;
    if (filter.type) where.type = filter.type;
    if (filter.isRead !== undefined) where.is_read = filter.isRead;
    if (filter.relatedProjectId) where.related_project_id = filter.relatedProjectId;
    if (filter.relatedProcessId) where.related_process_id = filter.relatedProcessId;
    if (filter.relatedTaskId) where.related_task_id = filter.relatedTaskId;

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        user: true,
        project: true,
        process: true,
        task: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return notifications.map(notification => this.mapNotification(notification));
  }

  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { user_id: userId },
      include: {
        user: true,
        project: true,
        process: true,
        task: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return notifications.map(notification => this.mapNotification(notification));
  }

  async markAsRead(markNotificationReadInput: MarkNotificationReadInput): Promise<boolean> {
    await this.prisma.notification.update({
      where: { id: markNotificationReadInput.notificationId },
      data: { is_read: true },
    });

    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });

    return true;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    // Garantizar que el usuario solo borre sus propias notificaciones
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
    return true;
  }

  async clearNotifications(userId: string, options?: { onlyRead?: boolean; olderThanDays?: number }): Promise<number> {
    const where: any = { user_id: userId };
    if (options?.onlyRead) where.is_read = true;
    if (options?.olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - options.olderThanDays);
      where.created_at = { lt: cutoff };
    }

    const result = await this.prisma.notification.deleteMany({ where });
    return result.count;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  // Limpieza global: elimina notificaciones según criterios (por defecto, leídas y > 7 días)
  async clearOldNotificationsGlobal(options?: { onlyRead?: boolean; olderThanDays?: number }): Promise<number> {
    const onlyRead = options?.onlyRead ?? true;
    const olderThanDays = options?.olderThanDays ?? 7;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    cutoff.setHours(0, 0, 0, 0);

    const where: any = { created_at: { lt: cutoff } };
    if (onlyRead) where.is_read = true;

    const result = await this.prisma.notification.deleteMany({ where });
    return result.count;
  }

  // ==================== NOTIFICATION GENERATION METHODS ====================

  async generateDailySummaryNotifications(): Promise<void> {
    this.logger.debug('Starting daily summary notifications generation...');
    
    const users = await this.prisma.user.findMany({
      where: { isactive: true },
      include: {
        project_member: {
          include: { project: true }
        },
        task_member: {
          include: { task: true }
        }
      }
    });

    for (const user of users) {
      await this.generateUserDailySummary(user);
    }

    this.logger.debug('Daily summary notifications completed');
  }

  private async generateUserDailySummary(user: any): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's project and task IDs
    const userProjectIds = user.project_member.map(pm => pm.project.id);
    const userTaskIds = user.task_member.map(tm => tm.task.id);

    // Get recent changes in user's projects/tasks
    const recentChanges = await this.prisma.logs.findMany({
      where: {
        createdat: { gte: yesterday },
        OR: [
          { idproject: { in: userProjectIds } },
          { idtask: { in: userTaskIds } }
        ]
      },
      include: {
        project: true,
        task: true,
        process: true
      }
    });

    if (recentChanges.length === 0) return;

    // Generate summary notification
    const changesByType = this.groupChangesByType(recentChanges);
    const summaryMessage = this.buildSummaryMessage(changesByType);

    const { title, message } = buildNotificationTexts(
      NotificationType.DAILY_SUMMARY,
      {},
      { message: summaryMessage }
    );

    await this.createNotification({
      userId: user.id,
      type: NotificationType.DAILY_SUMMARY,
      title,
      message,
    });
  }

  async generateTaskDueSoonNotifications(): Promise<void> {
    this.logger.debug('Starting task due soon notifications...');
    
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    const tasksDueSoon = await this.prisma.task.findMany({
      where: {
        duedateat: {
          gte: new Date(),
          lte: fiveDaysFromNow
        },
        status: { not: 'completed' },
        archived_at: null,
        task_member: { some: {} }
      },
      include: {
        task_member: {
          include: { user: true }
        },
        process: {
          include: { project: true }
        }
      }
    });

    for (const task of tasksDueSoon) {
      // Verificar que la tarea tenga fecha de vencimiento y proyecto
      if (!task.duedateat || !task.process.project) continue;
      
      for (const taskMember of task.task_member) {
        const daysUntilDue = Math.ceil((task.duedateat.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        await this.createFromTemplate(
          taskMember.user.id,
          NotificationType.TASK_DUE_SOON,
          {
            taskName: task.name,
            days: daysUntilDue,
            projectName: task.process.project.name,
          },
          { projectId: task.process.project.id, processId: task.process.id, taskId: task.id }
        );
      }
    }

    this.logger.debug('Task due soon notifications completed');
  }

  async generateOverdueTaskNotifications(): Promise<void> {
    this.logger.debug('Starting overdue task notifications...');
    
    const now = new Date();
    
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        duedateat: { lt: now },
        status: { not: 'completed' },
        archived_at: null,
        task_member: { some: {} }
      },
      include: {
        task_member: {
          include: { user: true }
        },
        process: {
          include: { project: true }
        }
      }
    });

    for (const task of overdueTasks) {
      // Verificar que la tarea tenga fecha de vencimiento y proyecto
      if (!task.duedateat || !task.process.project) continue;
      
      for (const taskMember of task.task_member) {
        const daysOverdue = Math.ceil((now.getTime() - task.duedateat.getTime()) / (1000 * 60 * 60 * 24));
        
        await this.createFromTemplate(
          taskMember.user.id,
          NotificationType.TASK_OVERDUE,
          {
            taskName: task.name,
            days: daysOverdue,
            projectName: task.process.project.name,
          },
          { projectId: task.process.project.id, processId: task.process.id, taskId: task.id }
        );
      }
    }

    this.logger.debug('Overdue task notifications completed');
  }

  // ==================== HELPER METHODS ====================

  private mapNotification(notification: any): Notification {
    return {
      id: notification.id,
      userId: notification.user_id,
      user: notification.user,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.is_read,
      createdAt: notification.created_at,
      relatedProjectId: notification.related_project_id,
      project: notification.project,
      relatedProcessId: notification.related_process_id,
      process: notification.process,
      relatedTaskId: notification.related_task_id,
      task: notification.task,
    };
  }

  private groupChangesByType(changes: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const change of changes) {
      if (!grouped[change.type]) {
        grouped[change.type] = [];
      }
      grouped[change.type].push(change);
    }
    
    return grouped;
  }

  private buildSummaryMessage(changesByType: Record<string, any[]>): string {
    let message = 'Actividad reciente en tus proyectos:\n\n';
    
    for (const [type, changes] of Object.entries(changesByType)) {
      const count = changes.length;
      const typeLabel = this.getChangeTypeLabel(type);
      message += `• ${typeLabel}: ${count} ${count === 1 ? 'evento' : 'eventos'}\n`;
    }
    
    message += '\nRevisa los detalles en tu panel de control.';
    return message;
  }

  private getChangeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'project_created': 'Proyectos creados',
      'project_updated': 'Proyectos actualizados',
      'process_created': 'Procesos creados',
      'process_updated': 'Procesos actualizados',
      'task_created': 'Tareas creadas',
      'task_updated': 'Tareas actualizadas',
      'task_assigned': 'Tareas asignadas',
      'task_status_changed': 'Cambios de estado',
      'evidence_uploaded': 'Evidencias subidas',
      'comment_added': 'Comentarios agregados',
      'member_added': 'Miembros agregados',
      'member_removed': 'Miembros removidos'
    };
    
    return labels[type] || type;
  }
}
