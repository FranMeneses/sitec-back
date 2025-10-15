import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // Ejecutar de lunes a viernes a las 8:00 AM (0=Domingo, 1=Lunes, ... 5=Viernes)
  @Cron('0 8 * * 1-5', {
    name: 'daily-notifications',
    timeZone: 'America/Santiago', // Zona horaria de Santiago de Chile
  })
  async handleDailyNotifications() {
    this.logger.debug('Starting weekday daily notification generation...');
    
    try {
      // Generar resumen diario
      await this.notificationsService.generateDailySummaryNotifications();
      
      // Generar notificaciones de tareas próximas a vencer
      await this.notificationsService.generateTaskDueSoonNotifications();
      
      // Generar notificaciones de tareas vencidas
      await this.notificationsService.generateOverdueTaskNotifications();
      
      this.logger.debug('Daily notifications completed successfully');
    } catch (error) {
      this.logger.error('❌ Error generating daily notifications:', error);
    }
  }


  // Cron semanal: domingo a las 04:00 AM para limpiar notificaciones leídas > 7 días
  @Cron('0 4 * * 0', {
    name: 'weekly-notifications-cleanup',
    timeZone: 'America/Santiago',
  })
  async handleWeeklyCleanup() {
    this.logger.debug('Starting weekly notifications cleanup...');
    try {
      const removedRead = await this.notificationsService.clearOldNotificationsGlobal({ onlyRead: true, olderThanDays: 7 });
      const removedAll = await this.notificationsService.clearOldNotificationsGlobal({ onlyRead: false, olderThanDays: 14 });
      this.logger.debug(`Weekly cleanup done. Removed read>7d: ${removedRead}. Removed all>14d: ${removedAll}`);
    } catch (error) {
      this.logger.error('Error in weekly notifications cleanup:', error);
    }
  }

  // Método manual para testing (opcional)
  async runManualNotificationGeneration(): Promise<void> {
    this.logger.log('🔧 Running manual notification generation...');
    
    try {
      await this.notificationsService.generateDailySummaryNotifications();
      await this.notificationsService.generateTaskDueSoonNotifications();
      await this.notificationsService.generateOverdueTaskNotifications();
      
      this.logger.log('✅ Manual notification generation completed');
    } catch (error) {
      this.logger.error('❌ Error in manual notification generation:', error);
    }
  }
}
