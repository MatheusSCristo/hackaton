import { BadRequestException } from "@nestjs/common";

import type { LegacyTokenInfo } from "./legacy-auth.service";

/**
 * Extração dos identificadores a partir do payload de `/users/get-token-info`.
 *
 * ⚠️ O legado devolve o **AccessToken**, com o usuário aninhado
 * (`token.__data.user = user; fn(null, token)` em `usuario.js`). Consequência
 * crítica: **`id` no topo é a string do TOKEN**, não o id do usuário. O id real
 * está em `userId` (do AccessToken) ou em `user.id`.
 *
 * Usar `id` como identidade do professor grava o token no nosso banco e quebra
 * a titularidade quando o token rotaciona — por isso estes helpers existem e
 * todo controller deve passar por eles.
 */

function usuarioAninhado(user: LegacyTokenInfo | undefined) {
  const aninhado = user?.user;
  if (typeof aninhado !== "object" || aninhado === null) return undefined;
  return aninhado as Record<string, unknown>;
}

function paraNumero(valor: unknown): number | undefined {
  if (valor === undefined || valor === null || valor === "") return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

/** Id numérico do usuário no legado (`usuario.id`). */
export function legacyUsuarioId(
  user: LegacyTokenInfo | undefined,
): number | undefined {
  return (
    paraNumero(user?.userId) ?? paraNumero(usuarioAninhado(user)?.id)
    // Nunca `user.id`: esse é o token.
  );
}

/** Empresa do usuário — vem do AccessToken, com o usuário como reserva. */
export function legacyEmpId(
  user: LegacyTokenInfo | undefined,
): number | undefined {
  return paraNumero(user?.emp_id) ?? paraNumero(usuarioAninhado(user)?.emp_id);
}

/** Perfil (5 = Administrador, 6 = Professor). */
export function legacyPerfilId(
  user: LegacyTokenInfo | undefined,
): number | undefined {
  return (
    paraNumero(user?.pusu_id) ?? paraNumero(usuarioAninhado(user)?.pusu_id)
  );
}

/**
 * Identidade do professor usada como chave nas nossas tabelas.
 * Estável entre sessões — ao contrário do token.
 */
export function requireProfessorId(user: LegacyTokenInfo | undefined): string {
  const id = legacyUsuarioId(user);
  if (id === undefined) {
    throw new BadRequestException("Professor não identificado no token.");
  }
  return String(id);
}
