import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // Ejecutar todos los días a las 8:00 AM
  @Cron('0 8 * * *', {
    name: 'daily-notifications',
    timeZone: 'America/Santiago', // Zona horaria de Santiago de Chile
  })
  async handleDailyNotifications() {
    this.logger.log('🕐 Starting daily notification generation...');
    
    try {
      // Generar resumen diario
      await this.notificationsService.generateDailySummaryNotifications();
      
      // Generar notificaciones de tareas próximas a vencer
      await this.notificationsService.generateTaskDueSoonNotifications();
      
      // Generar notificaciones de tareas vencidas
      await this.notificationsService.generateOverdueTaskNotifications();
      
      this.logger.log('✅ Daily notifications completed successfully');
    } catch (error) {
      this.logger.error('❌ Error generating daily notifications:', error);
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
