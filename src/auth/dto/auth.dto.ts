import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { User } from '../entities/user.entity';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;
}

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;
}

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsString()
  @MinLength(6)
  password?: string;

  @Field({ nullable: true })
  @IsString()
  idRole?: string;

  @Field({ nullable: true })
  @IsString()
  idArea?: string;

  @Field({ nullable: true })
  havePassword?: boolean;
}

@InputType()
export class UpdateUserInput {
  @Field()
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsString()
  @MinLength(6)
  password?: string;

  @Field({ nullable: true })
  @IsString()
  idRole?: string;

  @Field({ nullable: true })
  @IsString()
  idArea?: string;

  @Field({ nullable: true })
  havePassword?: boolean;

  @Field({ nullable: true })
  isActive?: boolean;
}

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken: string;

  @Field(() => User)
  user: User;
}

@ObjectType()
export class GoogleAuthResponse {
  @Field()
  accessToken: string;

  @Field(() => User)
  user: User;

  @Field()
  isNewUser: boolean;
}
