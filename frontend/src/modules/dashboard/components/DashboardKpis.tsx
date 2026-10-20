import { KpiCard } from '@/components/KpiCard';
import type { DashboardResponse } from '@/interfaces/dashboard';
import { formatCurrency, formatPercent } from '@/utils/format';
import { prazoView, restanteView } from '../kpis';

interface DashboardKpisProps {
  dashboard: DashboardResponse;
}

export const DashboardKpis = ({ dashboard }: DashboardKpisProps) => {
  // Constants derivadas
  const prazo = prazoView(dashboard.prazo);
  const restante = restanteView(dashboard.valores);

  // Return
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Avanço físico"
        value={formatPercent(dashboard.avancoFisicoPercentual)}
        hint="Calculado a partir das etapas"
        tone="info"
      />
      <KpiCard
        label="Prazo restante"
        // Texto (não número) em fonte menor: "Prazo vencido há 12 dias" não cabe em 22px no card de 1280.
        value={prazo.longo ? <span className="text-[15px]">{prazo.value}</span> : prazo.value}
        hint={prazo.hint}
        tone={prazo.tone}
      />
      <KpiCard
        label="Custo acumulado"
        value={formatCurrency(dashboard.valores.valorMedidoAcumulado)}
        // Custo acumulado = medições aprovadas (nunca custo real da empresa). O total pago é outra coisa: linha à parte.
        hint={
          <>
            <span className="block">medições aprovadas</span>
            <span className="block">Pago: {formatCurrency(dashboard.valores.totalPago)}</span>
          </>
        }
        tone="info"
      />
      <KpiCard label={restante.label} value={restante.value} hint={restante.hint} tone={restante.tone} />
    </div>
  );
};
