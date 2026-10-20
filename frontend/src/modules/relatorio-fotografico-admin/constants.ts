import type { RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';
import { RELATORIO_TIPO_LABEL } from '@/utils/relatorioFotografico';

/** `relatorios_fotograficos.titulo` VARCHAR(150). */
export const TITULO_MAX_LENGTH = 150;

export const TABS: { value: RelatorioFotograficoTipo; label: string }[] = [
  { value: 'mensal', label: RELATORIO_TIPO_LABEL.mensal },
  { value: 'etapa', label: RELATORIO_TIPO_LABEL.etapa },
];

export const MENSAGEM_VAZIO_TIPO: Record<RelatorioFotograficoTipo, string> = {
  mensal: 'Nenhum relatório mensal nesta obra.',
  etapa: 'Nenhum relatório por etapa nesta obra.',
};
