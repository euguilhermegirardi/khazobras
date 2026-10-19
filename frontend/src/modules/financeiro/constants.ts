import type { LancamentoCategoria } from '@/interfaces/financeiro';

export const PAGE_SIZE = 20;

/** Linguagem simples para o cliente. Aceita PascalCase (resposta) e snake_case (por segurança). */
export const CATEGORIA_LABEL: Record<LancamentoCategoria, string> = {
  MaoDeObra: 'Mão de obra',
  Material: 'Material',
  Equipamento: 'Equipamento',
  mao_de_obra: 'Mão de obra',
  material: 'Material',
  equipamento: 'Equipamento',
};
