import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { ProjectStatus } from '../dto/project-status.enum';

@ObjectType()
export class Project {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  editedAt?: Date;

  @Field(() => User, { nullable: true })
  editor?: User;

  @Field({ nullable: true })
  categoryId?: string;

  @Field({ nullable: true })
  unitId?: number;

  @Field({ nullable: true })
  review?: string;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field({ nullable: true })
  archivedAt?: Date;

  @Field({ nullable: true })
  archivedBy?: string;

  @Field(() => User, { nullable: true })
  archivedByUser?: User;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;

  // Relaciones que se resolverán después
  // @Field(() => Category, { nullable: true })
  // category?: Category;
  
  // @Field(() => Unit, { nullable: true })
  // unit?: Unit;
  
  // @Field () => [ProjectMember])
  // members?: ProjectMember[];
}
