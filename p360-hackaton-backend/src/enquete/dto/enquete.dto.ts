import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GerarEnqueteDto {
  /** Sobrescreve o `nPerguntas` da config do bloco. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  nPerguntas?: number;

  /** Idioma do conteúdo gerado (default pt-BR). */
  @IsOptional()
  @IsString()
  idioma?: string;
}
