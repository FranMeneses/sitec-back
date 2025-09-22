import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { LoginInput, RegisterInput, AuthResponse, GoogleAuthResponse, GoogleAuthDto, CreateUserInput, UpdateUserInput } from '../dto/auth.dto';
import { User } from '../entities/user.entity';
import { Project } from '../../project/entities/project.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireAdmin } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';

@Resolver(() => User)
export class AuthResolver {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Mutation(() => AuthResponse)
  async login(@Args('loginInput') loginInput: LoginInput): Promise<AuthResponse> {
    return this.authService.login(loginInput);
  }

  @Mutation(() => AuthResponse)
  async register(@Args('registerInput') registerInput: RegisterInput): Promise<AuthResponse> {
    return this.authService.register(registerInput);
  }

  @Mutation(() => GoogleAuthResponse)
  async googleAuth(@Args('googleAuthDto') googleAuthDto: GoogleAuthDto): Promise<GoogleAuthResponse> {
    return this.authService.googleAuth(googleAuthDto.googleToken);
  }

  @Mutation(() => AuthResponse)
  async createFirstSuperAdmin(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthResponse> {
    // Crear el primer super_admin
    const user = await this.userService.createSuperAdmin({
      name,
      email,
      password,
    });

    // Generar token
    const accessToken = await this.authService.generateJwtToken(user);

    return {
      accessToken,
      user,
    };
  }

  @Query(() => Boolean)
  async checkSuperAdminExists(): Promise<boolean> {
    return this.userService.checkSuperAdminExists();
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async user(@Args('id') id: string): Promise<User> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    return user;
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async findUserByEmail(@Args('email') email: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }
    return user;
  }

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async findUsersProject(@Args('idUser') idUser: string): Promise<Project[]> {
    return this.userService.findUsersProject(idUser);
  }

  @Query(() => [User])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAdmin()
  async users(): Promise<User[]> {
    // Obtener todos los usuarios - el guard ya validó los permisos
    return this.userService.findAllUsers();
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<User> {
    if (!name) return user;
    
    return this.userService.updateUser(user.id, { name });
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async createUser(
    @Args('createUserInput') createUserInput: CreateUserInput,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    // Verificar si el usuario actual es admin
    const isUserAdmin = await this.userService.isAdmin(currentUser.id);
    if (!isUserAdmin) {
      throw new Error('Access denied. Only administrators can create users.');
    }

    return this.userService.createUser(createUserInput);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    // Verificar si el usuario actual es admin
    const isUserAdmin = await this.userService.isAdmin(currentUser.id);
    if (!isUserAdmin) {
      throw new Error('Access denied. Only administrators can update users.');
    }

    return this.userService.updateUser(updateUserInput.id, updateUserInput);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async removeUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    // Verificar si el usuario actual es admin
    const isUserAdmin = await this.userService.isAdmin(currentUser.id);
    if (!isUserAdmin) {
      throw new Error('Access denied. Only administrators can remove users.');
    }

    // Verificar que no se esté eliminando a sí mismo
    if (id === currentUser.id) {
      throw new Error('Cannot remove your own account.');
    }

    return this.userService.removeUser(id);
  }
}
