import type { RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';

export const TABS: { value: RelatorioFotograficoTipo; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'etapa', label: 'Etapa' },
];

export const MENSAGEM_VAZIO: Record<RelatorioFotograficoTipo, string> = {
  mensal:
    'Nenhum relatório fotográfico mensal foi publicado ainda. Quando a Khaz Engenharia enviar as fotos do mês, elas aparecem aqui.',
  etapa:
    'Nenhum relatório fotográfico por etapa foi publicado ainda. Quando a Khaz Engenharia enviar as fotos de uma etapa, elas aparecem aqui.',
};
