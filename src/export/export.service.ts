import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserService } from '../auth/user/user.service';

@Injectable()
export class ExportService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  /**
   * Exporta todos los datos de proyectos, procesos y tareas por área
   */
  async exportDataByArea(userId: string, areaId?: number): Promise<string> {
    // Verificar permisos del usuario
    await this.validateExportPermissions(userId, areaId);

    // Obtener datos según el área
    const data = await this.getExportData(areaId);
    
    // Generar CSV
    return this.generateCSV(data);
  }

  /**
   * Valida que el usuario tenga permisos para exportar datos
   */
  private async validateExportPermissions(userId: string, areaId?: number): Promise<void> {
    // Super admin puede exportar cualquier área
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) return;

    // Admin puede exportar solo su área
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) {
      const adminArea = await this.prisma.admin.findFirst({
        where: { iduser: userId },
        select: { idarea: true }
      });

      if (!adminArea) {
        throw new ForbiddenException('No tienes permisos para exportar datos');
      }

      if (areaId && areaId !== adminArea.idarea) {
        throw new ForbiddenException('Solo puedes exportar datos de tu área');
      }

      return;
    }

    // Area_member puede exportar solo su área
    const isAreaMember = await this.prisma.area_member.findFirst({
      where: { iduser: userId },
      select: { idarea: true }
    });

    if (isAreaMember) {
      if (areaId && areaId !== isAreaMember.idarea) {
        throw new ForbiddenException('Solo puedes exportar datos de tu área');
      }
      return;
    }

    throw new ForbiddenException('No tienes permisos para exportar datos');
  }

  /**
   * Obtiene los datos para exportar
   */
  private async getExportData(areaId?: number) {
    const whereClause = areaId ? { category: { id_area: areaId } } : {};

    const projects = await this.prisma.project.findMany({
      where: {
        ...whereClause,
        archived_at: null
      },
      include: {
        category: {
          include: {
            area: true
          }
        },
        unit: true,
        process: {
          where: { archived_at: null },
          include: {
            task: {
              where: { archived_at: null },
              select: {
                id: true,
                name: true,
                description: true,
                status: true,
                percent: true,
                budget: true,
                expense: true,
                startdate: true,
                duedateat: true,
                editedat: true,
                report: true,
                review: true
              }
            }
          }
        }
      },
      orderBy: [
        { category: { area: { name: 'asc' } } },
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    return projects;
  }

  /**
   * Genera el CSV con todos los datos
   */
  private generateCSV(projects: any[]): string {
    const headers = [
      'Area',
      'Categoria',
      'Proyecto',
      'Unidad',
      'Proceso',
      'Tarea',
      'Descripcion_Tarea',
      'Estado_Tarea',
      'Porcentaje_Tarea',
      'Presupuesto_Tarea',
      'Gasto_Tarea',
      'Fecha_Inicio_Tarea',
      'Fecha_Vencimiento_Tarea',
      'Fecha_Edicion_Tarea',
      'Reporte_Tarea',
      'Revision_Tarea',
      'Fecha_Inicio_Proyecto',
      'Fecha_Vencimiento_Proyecto',
      'Porcentaje_Proyecto',
      'Estado_Proyecto'
    ];

    const rows: any[] = [];

    for (const project of projects) {
      const baseRow: any[] = [
        project.category?.area?.name || '',
        project.category?.name || '',
        project.name || '',
        project.unit?.name || '',
        '', // Proceso se llenará en el loop
        '', // Tarea se llenará en el loop
        '', // Descripción se llenará en el loop
        '', // Estado se llenará en el loop
        '', // Porcentaje se llenará en el loop
        '', // Presupuesto se llenará en el loop
        '', // Gasto se llenará en el loop
        '', // Fecha inicio se llenará en el loop
        '', // Fecha vencimiento se llenará en el loop
        '', // Fecha edición se llenará en el loop
        '', // Reporte se llenará en el loop
        '', // Revisión se llenará en el loop
        project.startdate ? this.formatDate(project.startdate) : '',
        project.duedate ? this.formatDate(project.duedate) : '',
        project.percent || 0,
        project.status || ''
      ];

      if (project.process.length === 0) {
        // Si no hay procesos, agregar solo la fila del proyecto
        rows.push([...baseRow]);
      } else {
        for (const process of project.process) {
          const processRow: any[] = [...baseRow];
          processRow[4] = process.name || ''; // Proceso

          if (process.task.length === 0) {
            // Si no hay tareas, agregar solo la fila del proceso
            rows.push([...processRow]);
          } else {
            for (const task of process.task) {
              const taskRow: any[] = [...processRow];
              taskRow[5] = task.name || ''; // Tarea
              taskRow[6] = task.description || ''; // Descripción
              taskRow[7] = task.status || ''; // Estado
              taskRow[8] = task.percent || 0; // Porcentaje
              taskRow[9] = task.budget || 0; // Presupuesto
              taskRow[10] = task.expense || 0; // Gasto
              taskRow[11] = task.startdate ? this.formatDate(task.startdate) : ''; // Fecha inicio
              taskRow[12] = task.duedateat ? this.formatDate(task.duedateat) : ''; // Fecha vencimiento
              taskRow[13] = task.editedat ? this.formatDate(task.editedat) : ''; // Fecha edición
              taskRow[14] = task.report || ''; // Reporte
              taskRow[15] = task.review || ''; // Revisión

              rows.push(taskRow);
            }
          }
        }
      }
    }

    // Convertir a CSV
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => this.escapeCSV(cell)).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Escapa valores para CSV
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);
    
    // Si contiene comas, comillas o saltos de línea, envolver en comillas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Formatea fechas para CSV
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Obtiene las áreas disponibles para el usuario
   */
  async getAvailableAreas(userId: string): Promise<Array<{id: number, name: string}>> {
    // Super admin puede ver todas las áreas
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    if (isSuperAdmin) {
      const areas = await this.prisma.area.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });
      return areas.map(area => ({ id: area.id, name: area.name || '' }));
    }

    // Admin puede ver solo su área
    const isAdmin = await this.userService.isAdmin(userId);
    if (isAdmin) {
      const adminArea = await this.prisma.admin.findFirst({
        where: { iduser: userId },
        include: { area: true }
      });

      if (adminArea?.area) {
        return [{ id: adminArea.area.id, name: adminArea.area.name || '' }];
      }
    }

    // Area_member puede ver solo su área
    const isAreaMember = await this.prisma.area_member.findFirst({
      where: { iduser: userId },
      include: { area: true }
    });

    if (isAreaMember?.area) {
      return [{ id: isAreaMember.area.id, name: isAreaMember.area.name || '' }];
    }

    return [];
  }
}
