import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../user/user.service';
import { User } from '../entities/user.entity';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginInput, RegisterInput, AuthResponse, GoogleAuthResponse } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {
    // Inicializar cliente de Google OAuth2
    this.googleClient = new OAuth2Client();
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    
    if (!user || !user.havePassword || !user.password) {
      return null;
    }

    const isPasswordValid = await this.userService.validatePassword(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(loginInput: LoginInput): Promise<AuthResponse> {
    const user = await this.validateUser(loginInput.email, loginInput.password);
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Obtener usuario con roles para incluir en la respuesta
    const userWithRoles = await this.userService.findByIdWithRoles(user.id);
    
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: userWithRoles, // Incluye roles del sistema
    };
  }

  async register(registerInput: RegisterInput): Promise<AuthResponse> {
    // Inicializar roles por defecto si no existen
    await this.userService.initializeDefaultRoles();

    // Validar dominio UCN
    const isValidEmail = await this.userService.isValidUCNEmail(registerInput.email);
    if (!isValidEmail) {
      throw new BadRequestException('Solo se permiten correos de dominios UCN (@alumnos.ucn.cl, @ce.ucn.cl, @ucn.cl)');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.userService.findByEmail(registerInput.email);
    if (existingUser) {
      throw new BadRequestException('El usuario ya existe');
    }

    // Crear usuario
    const user = await this.userService.createUser({
      name: registerInput.name,
      email: registerInput.email,
      password: registerInput.password,
      havePassword: true,
    });

    // Obtener usuario con roles para incluir en la respuesta
    const userWithRoles = await this.userService.findByIdWithRoles(user.id);

    // Generar token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: userWithRoles, // Incluye roles del sistema
    };
  }

  async validateGoogleUser(profile: any): Promise<any> {
    const email = profile.emails[0].value;
    
    // Validar dominio UCN
    const isValidEmail = await this.userService.isValidUCNEmail(email);
    if (!isValidEmail) {
      throw new BadRequestException('Solo se permiten correos de dominios UCN');
    }

    // Buscar usuario existente
    let user = await this.userService.findByEmail(email);
    
    if (!user) {
      // Crear nuevo usuario si no existe
      user = await this.userService.createUser({
        name: profile.displayName || (profile.name?.givenName + ' ' + profile.name?.familyName) || email.split('@')[0],
        email: email,
        havePassword: false,
      });
    }

    // Retornar usuario con roles
    return await this.userService.findByIdWithRoles(user.id);
  }

  async generateJwtToken(user: User | any): Promise<string> {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }

  async googleAuth(googleToken: string): Promise<GoogleAuthResponse> {
    // Inicializar roles por defecto si no existen
    await this.userService.initializeDefaultRoles();

    try {
      // Verificar el token de Google usando la librería oficial
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID, // Debe coincidir con el client ID de tu app
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Token de Google inválido');
      }

      const email = payload.email;
      const name = payload.name;
      const picture = payload.picture;

      if (!email) {
        throw new BadRequestException('Token de Google inválido: email no encontrado');
      }

      // Validar dominio UCN
      const isValidEmail = await this.userService.isValidUCNEmail(email);
      if (!isValidEmail) {
        throw new BadRequestException('Solo se permiten correos de dominios UCN');
      }

      // Buscar usuario existente
      let user = await this.userService.findByEmail(email);
      let isNewUser = false;
      
      if (!user) {
        // Crear nuevo usuario si no existe
        user = await this.userService.createUser({
          name: name || email.split('@')[0],
          email: email,
          havePassword: false,
        });
        isNewUser = true;
      }

      // Obtener usuario con roles
      const userWithRoles = await this.userService.findByIdWithRoles(user.id);

      // Generar JWT token
      const accessToken = await this.generateJwtToken(userWithRoles);

      return {
        accessToken,
        user: userWithRoles,
        isNewUser,
      };
    } catch (error) {
      console.error('Error en Google Auth:', error);
      throw new BadRequestException('Error en autenticación con Google: ' + error.message);
    }
  }

  async googleAuthWithInvitation(googleToken: string, invitationToken?: string): Promise<GoogleAuthResponse> {
    // Inicializar roles por defecto si no existen
    await this.userService.initializeDefaultRoles();

    try {
      // Verificar el token de Google usando la librería oficial
      const ticket = await this.googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Token de Google inválido');
      }

      const email = payload.email;
      const name = payload.name;
      const picture = payload.picture;

      if (!email) {
        throw new BadRequestException('Token de Google inválido: email no encontrado');
      }

      // Validar dominio UCN
      const isValidEmail = await this.userService.isValidUCNEmail(email);
      if (!isValidEmail) {
        throw new BadRequestException('Solo se permiten correos de dominios UCN');
      }

      // Buscar usuario existente
      let user = await this.userService.findByEmail(email);
      let isNewUser = false;
      
      if (!user) {
        // Crear nuevo usuario si no existe
        user = await this.userService.createUser({
          name: name || email.split('@')[0],
          email: email,
          havePassword: false,
        });
        isNewUser = true;
      }

      // Si hay un token de invitación, procesar la invitación
      if (invitationToken) {
        await this.processInvitationForUser(user.id, invitationToken);
      }

      // Obtener usuario con roles
      const userWithRoles = await this.userService.findByIdWithRoles(user.id);

      // Generar JWT token
      const accessToken = await this.generateJwtToken(userWithRoles);

      return {
        accessToken,
        user: userWithRoles,
        isNewUser,
      };
    } catch (error) {
      console.error('Error en Google Auth con invitación:', error);
      throw new BadRequestException('Error en autenticación con Google: ' + error.message);
    }
  }

  private async processInvitationForUser(userId: string, invitationToken: string): Promise<void> {
    try {
      // Buscar la invitación por token
      const invitation = await this.prisma.invitation.findUnique({
        where: { token: invitationToken },
        include: { project: true },
      });

      if (!invitation) {
        throw new BadRequestException('Invitación no encontrada');
      }

      // Verificar que la invitación no haya expirado
      if (new Date() > invitation.expires_at) {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'expired' },
        });
        throw new BadRequestException('La invitación ha expirado');
      }

      // Verificar que la invitación esté pendiente
      if (invitation.status !== 'pending') {
        throw new BadRequestException('La invitación ya fue procesada');
      }

      // Asignar al usuario al proyecto según el tipo de rol
      if (invitation.role_type === 'project_member') {
        await this.prisma.project_member.create({
          data: {
            idproject: invitation.project_id,
            iduser: userId,
          },
        });
      } else if (invitation.role_type === 'task_member') {
        // Para task_member, asignamos como project_member también
        await this.prisma.project_member.create({
          data: {
            idproject: invitation.project_id,
            iduser: userId,
          },
        });
      }

      // Marcar la invitación como aceptada
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          accepted_at: new Date(),
          accepted_by: userId,
        },
      });

      console.log(`Usuario ${userId} aceptó invitación al proyecto ${invitation.project_id}`);
    } catch (error) {
      console.error('Error procesando invitación:', error);
      throw error;
    }
  }
}
