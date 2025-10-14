import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Notification } from './entities/notification.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { NotificationFilterInput } from './dto/notification-filter.input';
import { MarkNotificationReadInput } from './dto/mark-notification-read.input';
import { NotificationType } from './dto/create-notification.input';

@Injectable()
export class NotificationsService {
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

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  // ==================== NOTIFICATION GENERATION METHODS ====================

  async generateDailySummaryNotifications(): Promise<void> {
    console.log('🔔 Starting daily summary notifications generation...');
    
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

    console.log('✅ Daily summary notifications completed');
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

    await this.createNotification({
      userId: user.id,
      type: NotificationType.DAILY_SUMMARY,
      title: '📊 Resumen de actividad diaria',
      message: summaryMessage,
    });
  }

  async generateTaskDueSoonNotifications(): Promise<void> {
    console.log('⏰ Starting task due soon notifications...');
    
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
        
        await this.createNotification({
          userId: taskMember.user.id,
          type: NotificationType.TASK_DUE_SOON,
          title: `⏰ Tarea próxima a vencer: ${task.name}`,
          message: `La tarea "${task.name}" vence en ${daysUntilDue} día(s). Proyecto: ${task.process.project.name}`,
          relatedTaskId: task.id,
          relatedProcessId: task.process.id,
          relatedProjectId: task.process.project.id
        });
      }
    }

    console.log('✅ Task due soon notifications completed');
  }

  async generateOverdueTaskNotifications(): Promise<void> {
    console.log('🚨 Starting overdue task notifications...');
    
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
        
        await this.createNotification({
          userId: taskMember.user.id,
          type: NotificationType.TASK_OVERDUE,
          title: `🚨 Tarea vencida: ${task.name}`,
          message: `La tarea "${task.name}" está vencida hace ${daysOverdue} día(s). Proyecto: ${task.process.project.name}`,
          relatedTaskId: task.id,
          relatedProcessId: task.process.id,
          relatedProjectId: task.process.project.id
        });
      }
    }

    console.log('✅ Overdue task notifications completed');
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
