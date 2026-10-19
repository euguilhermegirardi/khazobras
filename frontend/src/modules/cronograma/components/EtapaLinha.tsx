import { Badge } from '@/components/ui/badge';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { cn } from '@/utils/cn';
import { formatDateOnly } from '@/utils/dates';
import { BAR_CLASS, HOJE_CLASS, REAL_BAR_CLASS } from '../constants';
import { barBox, statusInfo, type TimelineRange } from '../timeline';

interface EtapaLinhaProps {
  etapa: EtapaCronograma;
  range: TimelineRange;
  /** Posição (% da grade) do marcador de hoje; null = fora da grade. */
  hojeLeft: number | null;
}

const realTexto = (inicio: string | null, fim: string | null): string | null => {
  if (inicio && fim) return `Real: ${formatDateOnly(inicio)} a ${formatDateOnly(fim)}`;
  if (inicio) return `Real: iniciada em ${formatDateOnly(inicio)}`;
  if (fim) return `Real: concluída em ${formatDateOnly(fim)}`;
  return null;
};

/** Uma linha da linha do tempo: nome, períodos por extenso, situação em texto e a barra. */
export const EtapaLinha = ({ etapa, range, hojeLeft }: EtapaLinhaProps) => {
  // Constants derivadas
  const { label, tone } = statusInfo(etapa.status);
  const { dataInicioPrevista, dataFimPrevista, dataInicioReal, dataFimReal } = etapa;
  const previsto =
    dataInicioPrevista && dataFimPrevista
      ? { inicio: formatDateOnly(dataInicioPrevista), fim: formatDateOnly(dataFimPrevista) }
      : null;
  const previstoBox = dataInicioPrevista && dataFimPrevista ? barBox(dataInicioPrevista, dataFimPrevista, range) : null;
  const realBox = dataInicioReal && dataFimReal ? barBox(dataInicioReal, dataFimReal, range) : null;
  const real = realTexto(dataInicioReal, dataFimReal);
  // Grade de meses: uma linha vertical por mês, em % (acompanha a largura flexível).
  const gridStyle = {
    backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px)',
    backgroundSize: `${100 / range.months}% 100%`,
  };

  // Return
  return (
    <li className="flex h-16 border-b last:border-b-0">
      <div className="sticky left-0 z-10 flex w-84 shrink-0 bg-card">
        <div className="flex w-56 min-w-0 flex-col justify-center gap-0.5 pr-3">
          <span className="truncate text-[13px] text-foreground" title={etapa.nome}>
            {etapa.nome}
          </span>
          {previsto && (
            <span className="text-[11px] text-muted-foreground">
              Previsto: {previsto.inicio} a {previsto.fim}
            </span>
          )}
          {real && <span className="text-[11px] text-muted-foreground">{real}</span>}
        </div>
        <div className="flex w-28 items-center">
          <Badge variant={tone}>{label}</Badge>
        </div>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-1 border-l" style={gridStyle}>
        {hojeLeft !== null && (
          <div
            aria-hidden
            className={cn('absolute inset-y-0 -translate-x-1/2', HOJE_CLASS)}
            style={{ left: `${hojeLeft}%` }}
          />
        )}
        {previstoBox && previsto ? (
          <div
            role="img"
            aria-label={`${etapa.nome}: previsto de ${previsto.inicio} a ${previsto.fim}, ${label}`}
            className={cn('h-3 rounded-sm', BAR_CLASS[tone])}
            style={{ marginLeft: `${previstoBox.left}%`, width: `${previstoBox.width}%` }}
          />
        ) : (
          <span className="px-2 text-[11px] text-muted-foreground">Sem datas previstas</span>
        )}
        {realBox && dataInicioReal && dataFimReal && (
          <div
            role="img"
            aria-label={`${etapa.nome}: realizado de ${formatDateOnly(dataInicioReal)} a ${formatDateOnly(dataFimReal)}`}
            className={cn('h-1.5 rounded-sm', REAL_BAR_CLASS)}
            style={{ marginLeft: `${realBox.left}%`, width: `${realBox.width}%` }}
          />
        )}
      </div>
    </li>
  );
};
