import { IsOptional, IsString, MaxLength } from "class-validator";

export class EntrarSessaoDto {
  /** Identificador de navegador, para quem entra sem login (enquete). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  anonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;
}
