import type { MedicaoItemTipo } from '@/interfaces/medicao';

/** Rótulo do tipo de item de medição (resposta em PascalCase). Compartilhado por Fechamento e Medições (admin). */
export const ITEM_TIPO_LABEL: Record<MedicaoItemTipo, string> = {
  MaoDeObra: 'Mão de obra',
  Material: 'Material',
  Equipamento: 'Equipamento',
};
