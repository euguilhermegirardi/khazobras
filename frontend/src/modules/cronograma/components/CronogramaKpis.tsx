import { KpiCard } from '@/components/KpiCard';

interface CronogramaKpisProps {
  total: number;
  concluidas: number;
  emAndamento: number;
  naoIniciadas: number;
}

export const CronogramaKpis = ({ total, concluidas, emAndamento, naoIniciadas }: CronogramaKpisProps) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <KpiCard label="Etapas totais" value={total} tone="info" />
    <KpiCard label="Concluídas" value={concluidas} tone="success" />
    <KpiCard label="Em andamento" value={emAndamento} tone="info" />
    <KpiCard label="Não iniciadas" value={naoIniciadas} tone="neutral" />
  </div>
);
