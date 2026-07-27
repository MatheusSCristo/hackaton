import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ORIGENS_BLOCO, TIPOS_BLOCO } from "../bloco-tipos";
import type { OrigemBloco, TipoBloco } from "../bloco-tipos";

export class CreateBlocoDto {
  @IsIn(TIPOS_BLOCO)
  tipo!: TipoBloco;

  @IsOptional()
  @IsIn(ORIGENS_BLOCO)
  origem?: OrigemBloco;

  /** Posição na sequência; quando omitida, o bloco vai para o fim. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateBlocoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ReorderBlocosDto {
  /** IDs dos blocos na nova ordem. */
  @IsArray()
  @IsString({ each: true })
  ordem!: string[];
}

export class ApplyTemplateDto {
  @IsString()
  templateId!: string;
}

export interface BlocoDto {
  id: string;
  ordem: number;
  tipo: string;
  origem: string;
  /** sessao (ao vivo) | pos_aula (fixação em casa) — derivado do tipo. */
  momento: string;
  config: Record<string, unknown>;
  output: Record<string, unknown> | null;
}
