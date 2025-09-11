import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../entities/user.entity';
import { LoginInput, RegisterInput, AuthResponse, GoogleAuthResponse } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

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
        name: profile.displayName,
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
      // Verificar el token de Google (esto requeriría una librería como google-auth-library)
      // Por ahora, asumimos que el token es válido y contiene la información del usuario
      // En una implementación real, deberías verificar el token con Google
      
      // Parsear el token (esto es un ejemplo simplificado)
      // En producción, deberías usar google-auth-library para verificar el token
      const tokenData = JSON.parse(Buffer.from(googleToken.split('.')[1], 'base64').toString());
      
      const email = tokenData.email;
      if (!email) {
        throw new BadRequestException('Token de Google inválido');
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
          name: tokenData.name || email.split('@')[0],
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
      throw new BadRequestException('Error en autenticación con Google: ' + error.message);
    }
  }
}
