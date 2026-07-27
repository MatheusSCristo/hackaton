import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SearchCasosDto {
  /** Tema/termo livre. Vazio = catálogo da empresa (sem filtro de texto). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Página (1-based, default 1). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Itens por página (1–50, default 6). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
