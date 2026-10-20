import { ProgressBar } from '@/components/ProgressBar';
import { Badge } from '@/components/ui/badge';
import type { DashboardEtapa } from '@/interfaces/dashboard';
import { etapaStatusInfo } from '@/utils/etapaStatus';

interface EtapaAvancoLinhaProps {
  etapa: DashboardEtapa;
}

/** Uma etapa (protótipo: nome à esquerda, % à direita, barra embaixo) + status à direita. Altura igual em todas. */
export const EtapaAvancoLinha = ({ etapa }: EtapaAvancoLinhaProps) => {
  const { label, tone } = etapaStatusInfo(etapa.status);

  return (
    <li className="flex h-11 items-center gap-3">
      <div className="min-w-0 flex-1">
        <ProgressBar label={etapa.nome} value={etapa.percentualConcluido} tone={tone} />
      </div>
      <div className="w-24 shrink-0">
        <Badge variant={tone}>{label}</Badge>
      </div>
    </li>
  );
};
