import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, Max, Min } from 'class-validator';

export class EnrollWorkerDto {
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  embeddingVector: number[];

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  qualityScore: number;
}
