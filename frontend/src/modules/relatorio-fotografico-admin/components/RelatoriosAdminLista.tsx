import type { Etapa } from '@/interfaces/etapa';
import type { RelatorioFotografico, RelatorioFotograficoTipo } from '@/interfaces/relatorioFotografico';
import { MENSAGEM_VAZIO_TIPO } from '../constants';
import { RelatorioAdminCard } from './RelatorioAdminCard';

interface RelatoriosAdminListaProps {
  tipo: RelatorioFotograficoTipo;
  relatorios: RelatorioFotografico[];
  etapas: Etapa[];
  detalhePath: (relatorioId: string) => string;
  onEdit: (relatorio: RelatorioFotografico) => void;
  onDelete: (relatorio: RelatorioFotografico) => void;
}

export const RelatoriosAdminLista = ({
  tipo,
  relatorios,
  etapas,
  detalhePath,
  onEdit,
  onDelete,
}: RelatoriosAdminListaProps) => {
  // Constants derivadas (mensal: mês mais novo primeiro, "yyyy-MM-dd" ordena como texto; etapa: ordem da API)
  const doTipo = relatorios.filter((r) => r.tipo === tipo);
  const lista =
    tipo === 'mensal' ? [...doTipo].sort((a, b) => (b.competencia ?? '').localeCompare(a.competencia ?? '')) : doTipo;

  // Retornos breves
  if (lista.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
        {MENSAGEM_VAZIO_TIPO[tipo]}
      </p>
    );
  }

  // Return
  return (
    <div className="grid grid-cols-3 gap-3.5">
      {lista.map((relatorio) => (
        <RelatorioAdminCard
          key={relatorio.id}
          relatorio={relatorio}
          etapaNome={etapas.find((e) => e.id === relatorio.etapaId)?.nome}
          detalhePath={detalhePath(relatorio.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
