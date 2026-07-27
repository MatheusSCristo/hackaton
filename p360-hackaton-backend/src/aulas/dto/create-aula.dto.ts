import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { CreateBlocoDto } from "./bloco.dto";

export class CreateAulaDto {
  @IsIn(["caso", "tema"])
  modo!: "caso" | "tema";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  casoLegacyId?: number;

  @IsOptional()
  @IsString()
  casoTitulo?: string;

  @IsOptional()
  @IsString()
  tema?: string;

  @IsOptional()
  @IsString()
  publico?: string;

  @IsOptional()
  @IsString()
  duracao?: string;

  @IsOptional()
  @IsString()
  formato?: string;

  @IsOptional()
  @IsString()
  objetivos?: string;

  /**
   * Materiais selecionados (modelo antigo). Mantido por compatibilidade com o
   * fluxo anterior; a sequência da aula agora vive em `blocos`.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materiais?: string[];

  /** Sequência de blocos da sessão, na ordem em que o professor montou. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBlocoDto)
  blocos?: CreateBlocoDto[];
}
