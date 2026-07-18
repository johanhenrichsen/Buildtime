import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber } from 'class-validator';

export class MatchFaceDto {
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  embeddingVector: number[];
}
