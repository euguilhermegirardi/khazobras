import type { ReactNode } from 'react';
import { ProgressBar } from '@/components/ProgressBar';
import { plural, type ResumoFila } from '@/utils/uploadFila';

interface UploadFilaPainelProps {
  resumo: ResumoFila;
  /** Cancelou com um envio em andamento: ele ainda termina. */
  cancelando: boolean;
  /** "foto" / "documento": usado no resumo ("2 de 3 fotos enviadas"). */
  singular: string;
  plural: string;
  /** As linhas (`<li>`) da fila. */
  children: ReactNode;
}

/** Progresso, resumo por status (lido pelo leitor de tela) e a lista rolável da fila de envio. */
export const UploadFilaPainel = ({
  resumo,
  cancelando,
  singular,
  plural: pluralTxt,
  children,
}: UploadFilaPainelProps) => {
  // Constants derivadas
  const tom = resumo.falhas > 0 ? 'warning' : resumo.enviadas === resumo.total ? 'success' : 'info';
  const resumoTexto = [
    `${resumo.enviadas} de ${plural(resumo.total, singular, pluralTxt)} ${resumo.enviadas === 1 ? 'enviada' : 'enviadas'}`,
    resumo.falhas > 0 ? plural(resumo.falhas, 'com erro', 'com erro') : null,
    resumo.canceladas > 0 ? plural(resumo.canceladas, 'cancelada', 'canceladas') : null,
    resumo.pendentes > 0 ? plural(resumo.pendentes, 'pendente', 'pendentes') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Return
  return (
    <div className="flex flex-col gap-2.5">
      <ProgressBar label="Progresso do envio" value={resumo.progresso} tone={tom} />
      <p role="status" aria-live="polite" className="text-[13px]">
        {resumoTexto}
        {cancelando && ' · cancelando: aguardando o envio atual terminar'}
      </p>
      <div
        role="region"
        aria-label="Fila de envio"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa de foco para rolar pelo teclado
        tabIndex={0}
        className="max-h-72 overflow-y-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ul>{children}</ul>
      </div>
    </div>
  );
};
