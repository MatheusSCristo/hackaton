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

export class IniciarEnqueteDto {
  /** Questão a subir (0-based). Ausente = primeira. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  indice?: number;
}

export class TrocarQuestaoDto {
  /** Questão pra qual a sala já foi trocada via WebSocket (0-based). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  indice!: number;
}
