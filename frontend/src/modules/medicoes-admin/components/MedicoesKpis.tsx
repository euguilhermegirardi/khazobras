import { KpiCard } from '@/components/KpiCard';
import { useMedicoesTotal } from '../hooks';

interface MedicoesKpisProps {
  obraId: string;
  /** Total da obra, já consultado pela página (evita repetir a mesma consulta). */
  total: number | undefined;
}

/**
 * Contagens da obra inteira (não só da página): 1 consulta por status com `pageSize=1`, lendo `totalItems`.
 * Enquanto carrega ou se uma consulta falhar, o indicador mostra "—" (a tabela segue funcionando).
 */
export const MedicoesKpis = ({ obraId, total }: MedicoesKpisProps) => {
  // Hooks
  const aguardando = useMedicoesTotal(obraId, 'pending_approval');
  const aprovadas = useMedicoesTotal(obraId, 'approved');
  const comNf = useMedicoesTotal(obraId, 'invoice_issued');

  // Functions
  const valor = (consulta: { data: number | undefined }) => consulta.data ?? '—';
  const valorTotal = total ?? '—';

  // Return
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total de medições" value={valorTotal} tone="info" />
      <KpiCard label="Aguardando aprovação" value={valor(aguardando)} tone="warning" />
      <KpiCard label="Aprovadas, aguardando NF" value={valor(aprovadas)} tone="success" />
      <KpiCard label="NF emitida" value={valor(comNf)} tone="neutral" />
    </div>
  );
};
