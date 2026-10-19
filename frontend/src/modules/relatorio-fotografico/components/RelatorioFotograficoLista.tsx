import type { Etapa } from '@/interfaces/etapa';
import type { RelatorioFotografico, RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';
import { MENSAGEM_VAZIO } from '../constants';
import { RelatorioFotograficoCard } from './RelatorioFotograficoCard';

interface RelatorioFotograficoListaProps {
  tipo: RelatorioFotograficoTipo;
  relatorios: RelatorioFotografico[];
  etapas: Etapa[];
}

export const RelatorioFotograficoLista = ({ tipo, relatorios, etapas }: RelatorioFotograficoListaProps) => {
  // Constants derivadas (mensal: mês mais novo primeiro; "yyyy-MM-dd" ordena como texto; etapa: ordem da API)
  const doTipo = relatorios.filter((r) => r.tipo === tipo);
  const lista =
    tipo === 'mensal' ? [...doTipo].sort((a, b) => (b.competencia ?? '').localeCompare(a.competencia ?? '')) : doTipo;

  // Retornos breves
  if (lista.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
        {MENSAGEM_VAZIO[tipo]}
      </p>
    );
  }

  // Return
  return (
    <div className="flex flex-col gap-3.5">
      {lista.map((relatorio) => (
        <RelatorioFotograficoCard
          key={relatorio.id}
          relatorio={relatorio}
          etapaNome={etapas.find((e) => e.id === relatorio.etapaId)?.nome}
        />
      ))}
    </div>
  );
};
