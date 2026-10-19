import { BAR_CLASS, HOJE_CLASS, REAL_BAR_CLASS } from '../constants';

interface CronogramaLegendaProps {
  /** Mostra a entrada "Hoje" (só quando o marcador aparece na grade). */
  comHoje: boolean;
}

const ITENS = [
  { texto: 'Concluída', classe: BAR_CLASS.success },
  { texto: 'Em andamento', classe: BAR_CLASS.info },
  { texto: 'Não iniciada', classe: BAR_CLASS.neutral },
];

export const CronogramaLegenda = ({ comHoje }: CronogramaLegendaProps) => (
  <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
    {ITENS.map((item) => (
      <li key={item.texto} className="flex items-center gap-1.5">
        <span aria-hidden className={`size-2.5 rounded-sm ${item.classe}`} />
        {item.texto}
      </li>
    ))}
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={`h-1.5 w-4 rounded-sm ${REAL_BAR_CLASS}`} />
      Período realizado
    </li>
    {comHoje && (
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={`h-3 ${HOJE_CLASS}`} />
        Hoje
      </li>
    )}
  </ul>
);
