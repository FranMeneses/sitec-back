import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from '../entities/user.entity';
import { LoginInput, RegisterInput, AuthResponse } from '../dto/auth.dto';

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
}
