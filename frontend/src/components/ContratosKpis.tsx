import { KpiCard } from '@/components/KpiCard';
import { saldoExibicao, somarContratos, type ValoresContrato } from '@/utils/contrato';
import { formatCurrency } from '@/utils/format';

interface ContratosKpisProps {
  contratos: ValoresContrato[];
}

/** Totais da obra (cliente e admin). Com um contrato só, os números já estão no card dele: não renderiza. */
export const ContratosKpis = ({ contratos }: ContratosKpisProps) => {
  if (contratos.length < 2) return null;

  // Constants derivadas
  const total = somarContratos(contratos);
  const saldo = saldoExibicao(total.saldoAPagar);

  // Return
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <KpiCard label="Valor contratado total" value={formatCurrency(total.valorContratado)} tone="info" />
      <KpiCard label="Total pago" value={formatCurrency(total.totalPago)} tone="success" />
      <KpiCard label={saldo.label} value={formatCurrency(saldo.valor)} tone={saldo.aMais ? 'danger' : 'warning'} />
    </div>
  );
};
