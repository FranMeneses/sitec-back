import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { ProjectModule } from './project/project.module';
import { ProcessModule } from './process/process.module';
import { ActivityModule } from './activity/activity.module';
// TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE UPLOADS DESHABILITADA PARA EL SPRINT ACTUAL
// import { UploadsModule } from './uploads/uploads.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Configuración inteligente según el entorno
      autoSchemaFile: process.env.VM_DEPLOYMENT === 'true'
        ? true // VM: generar en memoria para evitar problemas de permisos
        : join(process.cwd(), 'schema.gql'), // Render/Dev: generar archivo físico
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production' || process.env.ENABLE_GRAPHQL_INTROSPECTION === 'true',
      sortSchema: true,
      // Configurar contexto para pasar información de autenticación
      context: ({ req, res }) => ({ req, res }),
      // Configuraciones adicionales para estabilidad
      buildSchemaOptions: {
        dateScalarMode: 'isoDate',
      },
      // Configuración de CSRF
      csrfPrevention: false, // Deshabilitar CSRF para GraphQL
    }),
    CommonModule,
    AuthModule,
    OrganizationModule,
    ProjectModule,
    ProcessModule,
    ActivityModule,
    // TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE UPLOADS DESHABILITADA PARA EL SPRINT ACTUAL
    // UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
