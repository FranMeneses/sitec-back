import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { LoginInput, RegisterInput, AuthResponse } from '../dto/auth.dto';
import { User } from '../entities/user.entity';

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

  @Query(() => User, { nullable: true })
  async me(@Context() context: any): Promise<User | null> {
    // TODO: Implementar cuando tengamos el guard de JWT configurado
    // const userId = context.req.user?.sub;
    // if (!userId) return null;
    // return this.userService.findById(userId);
    return null;
  }

  @Query(() => [User])
  async users(): Promise<User[]> {
    // TODO: Agregar guard de admin cuando se implemente roles
    // Esta query debería estar protegida para solo administradores
    return [];
  }
}
