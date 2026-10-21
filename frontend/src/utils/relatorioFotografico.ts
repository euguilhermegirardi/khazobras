import type { Foto, RelatorioFotografico, RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';
import { formatMonthYearTitle } from './dates';

export const RELATORIO_TIPO_LABEL: Record<RelatorioFotograficoTipo, string> = {
  mensal: 'Mensal',
  etapa: 'Etapa',
};

/**
 * Título exibido do relatório: mensal com competência = "Setembro de 2026"; senão o nome da etapa (quando a tela a
 * conhece) e, por último, o título digitado.
 */
export function tituloDoRelatorio(
  relatorio: Pick<RelatorioFotografico, 'tipo' | 'competencia' | 'titulo'>,
  etapaNome?: string,
): string {
  if (relatorio.tipo === 'mensal' && relatorio.competencia) return formatMonthYearTitle(relatorio.competencia);
  return etapaNome ?? relatorio.titulo;
}

/** Fotos na mesma ordem do servidor: `ordem`, depois `createdAt`, depois `id`. Não altera o array recebido. */
export function ordenarFotos(fotos: Foto[]): Foto[] {
  return [...fotos].sort(
    (a, b) => a.ordem - b.ordem || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
