import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from './user/user.service';
import { AuthService } from './auth/auth.service';
import { AuthResolver } from './auth/auth.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RoleService } from './role/role.service';
import { RoleResolver } from './role/role.resolver';
import { SystemRoleModule } from './system-role/system-role.module';
import { GoogleAuthController } from './google-auth.controller';

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
    GoogleStrategy,
    JwtAuthGuard,
    GoogleAuthGuard,
    RoleService,
    RoleResolver,
  ],
  controllers: [GoogleAuthController],
  exports: [UserService, AuthService, JwtAuthGuard, GoogleAuthGuard],
})
export class AuthModule {}
