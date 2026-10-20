import type { LancamentoCategoria } from '@/interfaces/financeiro';
import type { CategoriaRequest } from '@/interfaces/financeiroAdmin';

/** Rótulos para a tela. Aceita PascalCase (resposta) e snake_case (por segurança). */
export const CATEGORIA_LABEL: Record<LancamentoCategoria, string> = {
  MaoDeObra: 'Mão de obra',
  Material: 'Material',
  Equipamento: 'Equipamento',
  mao_de_obra: 'Mão de obra',
  material: 'Material',
  equipamento: 'Equipamento',
};

const PARA_REQUEST: Record<LancamentoCategoria, CategoriaRequest> = {
  MaoDeObra: 'mao_de_obra',
  Material: 'material',
  Equipamento: 'equipamento',
  mao_de_obra: 'mao_de_obra',
  material: 'material',
  equipamento: 'equipamento',
};

/** Categoria da resposta (PascalCase) -> valor aceito pelo POST/PUT (snake_case). Desconhecida = material. */
export function categoriaParaRequest(categoria: LancamentoCategoria): CategoriaRequest {
  return PARA_REQUEST[categoria] ?? 'material';
}
