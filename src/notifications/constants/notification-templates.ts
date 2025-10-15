import { NotificationType } from '../dto/create-notification.input';

export interface NotificationTemplate {
  title: string;
  message: string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  [NotificationType.DAILY_SUMMARY]: {
    title: 'Resumen de actividad diaria',
    message: 'Actividad reciente en tus proyectos',
  },
  [NotificationType.TASK_DUE_SOON]: {
    title: 'Tarea próxima a vencer: {taskName}',
    message: 'La tarea "{taskName}" vence en {days} día(s). Proyecto: {projectName}'
  },
  [NotificationType.TASK_OVERDUE]: {
    title: 'Tarea vencida: {taskName}',
    message: 'La tarea "{taskName}" está vencida hace {days} día(s). Proyecto: {projectName}'
  },
  [NotificationType.PROJECT_UPDATE]: {
    title: 'Proyecto actualizado: {projectName}',
    message: '{actorName} realizó cambios en el proyecto "{projectName}"'
  },
  [NotificationType.PROCESS_UPDATE]: {
    title: 'Proceso actualizado: {processName}',
    message: '{actorName} realizó cambios en el proceso "{processName}" del proyecto "{projectName}"'
  },
  [NotificationType.TASK_ASSIGNED]: {
    title: 'Nueva tarea asignada: {taskName}',
    message: 'Te asignaron la tarea "{taskName}" en el proyecto "{projectName}"'
  },
  [NotificationType.TASK_STATUS_CHANGED]: {
    title: 'Estado actualizado: {taskName}',
    message: 'La tarea "{taskName}" cambió de {oldStatus} a {newStatus}'
  },
  [NotificationType.EVIDENCE_UPLOADED]: {
    title: 'Nueva evidencia en: {taskName}',
    message: '{actorName} subió evidencia a la tarea "{taskName}"'
  },
  [NotificationType.COMMENT_ADDED]: {
    title: 'Nuevo comentario en: {taskName}',
    message: '{actorName} comentó: "{commentSnippet}"'
  },
  [NotificationType.MEMBER_ADDED]: {
    title: 'Miembro agregado: {memberName}',
    message: '{memberName} se unió al proyecto "{projectName}"'
  },
  [NotificationType.MEMBER_REMOVED]: {
    title: 'Miembro removido: {memberName}',
    message: '{memberName} fue removido del proyecto "{projectName}"'
  }
};

export function getNotificationTemplate(type: NotificationType): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[type];
}

export function formatTemplate(template: string, vars: Record<string, any> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function buildNotificationTexts(
  type: NotificationType,
  vars: Record<string, any> = {},
  overrides?: { title?: string; message?: string }
): { title: string; message: string } {
  const template = getNotificationTemplate(type);
  const title = overrides?.title ?? formatTemplate(template.title, vars);
  const message = overrides?.message ?? formatTemplate(template.message, vars);
  return { title, message };
}
