import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from './user/user.service';
import { AuthService } from './auth/auth.service';
import { AuthResolver } from './auth/auth.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleService } from './role/role.service';
import { RoleResolver } from './role/role.resolver';
import { SystemRoleModule } from './system-role/system-role.module';

@Module({
  imports: [
    PassportModule,
    SystemRoleModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    UserService, 
    AuthService, 
    AuthResolver, 
    JwtStrategy,
    JwtAuthGuard,
    RoleService,
    RoleResolver,
  ],
  exports: [UserService, AuthService, JwtAuthGuard],
})
export class AuthModule {}
