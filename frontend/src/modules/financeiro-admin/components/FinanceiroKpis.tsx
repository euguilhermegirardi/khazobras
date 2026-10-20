import { KpiCard } from '@/components/KpiCard';
import type { FinanceiroResumo } from '@/interfaces/financeiroAdmin';
import { formatCurrency } from '@/utils/format';

interface FinanceiroKpisProps {
  /** Resumo da obra inteira. `undefined` = carregando ou falhou: os indicadores mostram "—" (a tabela segue). */
  resumo: FinanceiroResumo | undefined;
}

const SEM_VALOR = '—';
const quantidade = (n: number) => (n === 1 ? '1 lançamento' : `${n} lançamentos`);

/** Totais internos (custo real): só existem na visão admin. */
export const FinanceiroKpis = ({ resumo }: FinanceiroKpisProps) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <KpiCard
      label="Total lançado"
      value={resumo ? formatCurrency(resumo.totalLancado) : SEM_VALOR}
      hint={resumo && quantidade(resumo.quantidadeLancamentos)}
      tone="info"
    />
    <KpiCard
      label="Liberado ao cliente"
      value={resumo ? formatCurrency(resumo.totalLiberadoCliente) : SEM_VALOR}
      hint={resumo && quantidade(resumo.quantidadeLiberada)}
      tone="success"
    />
    <KpiCard
      label="Não liberado"
      value={resumo ? formatCurrency(resumo.totalNaoLiberado) : SEM_VALOR}
      hint={resumo && quantidade(resumo.quantidadeNaoLiberada)}
      tone="warning"
    />
  </div>
);
