import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class SemanticSearchDto {
  /** Tema da aula descrito pelo professor. */
  @IsString()
  @IsNotEmpty()
  tema!: string;

  /** Máximo de casos ranqueados retornados (1–20, default 10). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
