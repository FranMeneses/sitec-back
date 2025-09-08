import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class UploadResponse {
  @Field(() => ID)
  evidenceId: string;

  @Field()
  filename: string;

  @Field()
  originalName: string;

  @Field()
  filePath: string;

  @Field()
  fileUrl: string;

  @Field()
  mimeType: string;

  @Field()
  size: number;

  @Field()
  uploadedAt: Date;
}
