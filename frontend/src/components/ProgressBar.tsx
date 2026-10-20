import { cn } from '@/utils/cn';

interface ProgressBarProps {
  /** Rótulo à esquerda (ex.: nome da etapa). Também é o nome acessível da barra. */
  label: string;
  /** 0 a 100. */
  value: number;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Esconde o rótulo visível (ex.: dentro de uma linha de tabela); continua sendo o nome acessível. */
  hideLabel?: boolean;
}

const TONE_CLASS = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-neutral',
} as const;

/** Barra de progresso com rótulo e % (protótipo: .progress-label + .bar-track/.bar-fill). */
export const ProgressBar = ({ label, value, tone = 'info', hideLabel = false }: ProgressBarProps) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
        <span className={hideLabel ? 'sr-only' : 'min-w-0 truncate'} title={hideLabel ? undefined : label}>
          {label}
        </span>
        <span className="ml-auto">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded bg-muted"
      >
        <div className={cn('h-2 rounded', TONE_CLASS[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
