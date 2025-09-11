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
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: process.env.NODE_ENV !== 'production',
      introspection: true, // Necesario para que funcione con autoSchemaFile
      sortSchema: true,
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
