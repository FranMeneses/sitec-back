import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { CreateNotificationInput } from './dto/create-notification.input';
import { NotificationFilterInput } from './dto/notification-filter.input';
import { MarkNotificationReadInput } from './dto/mark-notification-read.input';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [Notification], { name: 'notifications' })
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @Args('filter', { nullable: true }) filter?: NotificationFilterInput,
  ): Promise<Notification[]> {
    return this.notificationsService.getNotifications(filter || {});
  }

  @Query(() => [Notification], { name: 'myNotifications' })
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(
    @CurrentUser() user: User,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit?: number,
  ): Promise<Notification[]> {
    return this.notificationsService.getNotificationsByUserId(user.id, limit);
  }

  @Query(() => Int, { name: 'unreadNotificationCount' })
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@CurrentUser() user: User): Promise<number> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Mutation(() => Notification, { name: 'createNotification' })
  @UseGuards(JwtAuthGuard)
  async createNotification(
    @Args('createNotificationInput') createNotificationInput: CreateNotificationInput,
  ): Promise<Notification> {
    return this.notificationsService.createNotification(createNotificationInput);
  }

  @Mutation(() => Boolean, { name: 'markNotificationAsRead' })
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Args('markNotificationReadInput') markNotificationReadInput: MarkNotificationReadInput,
  ): Promise<boolean> {
    return this.notificationsService.markAsRead(markNotificationReadInput);
  }

  @Mutation(() => Boolean, { name: 'markAllNotificationsAsRead' })
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@CurrentUser() user: User): Promise<boolean> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  // ==================== ADMIN METHODS ====================

  @Mutation(() => Boolean, { name: 'generateDailySummaryNotifications' })
  @UseGuards(JwtAuthGuard)
  async generateDailySummaryNotifications(): Promise<boolean> {
    await this.notificationsService.generateDailySummaryNotifications();
    return true;
  }

  @Mutation(() => Boolean, { name: 'generateTaskDueSoonNotifications' })
  @UseGuards(JwtAuthGuard)
  async generateTaskDueSoonNotifications(): Promise<boolean> {
    await this.notificationsService.generateTaskDueSoonNotifications();
    return true;
  }

  @Mutation(() => Boolean, { name: 'generateOverdueTaskNotifications' })
  @UseGuards(JwtAuthGuard)
  async generateOverdueTaskNotifications(): Promise<boolean> {
    await this.notificationsService.generateOverdueTaskNotifications();
    return true;
  }
}
