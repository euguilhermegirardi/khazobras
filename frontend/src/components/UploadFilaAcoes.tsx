import { Button } from '@/components/ui/button';
import { plural, type ResumoFila } from '@/utils/uploadFila';

interface UploadFilaAcoesProps {
  resumo: ResumoFila;
  rodando: boolean;
  cancelando: boolean;
  /** "foto" / "documento": rótulo do botão ("Enviar 3 fotos"). */
  singular: string;
  plural: string;
  onSend: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onClear: () => void;
}

/** Botões da fila: Enviar N, Cancelar fila, Tentar de novo (N) e Limpar finalizadas. */
export const UploadFilaAcoes = ({
  resumo,
  rodando,
  cancelando,
  singular,
  plural: pluralTxt,
  onSend,
  onCancel,
  onRetry,
  onClear,
}: UploadFilaAcoesProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button type="button" disabled={rodando || resumo.pendentes === 0} onClick={onSend}>
      {rodando ? 'Enviando…' : `Enviar ${plural(resumo.pendentes, singular, pluralTxt)}`}
    </Button>
    {(rodando || resumo.pendentes > 0) && (
      <Button type="button" variant="outline" disabled={cancelando} onClick={onCancel}>
        Cancelar fila
      </Button>
    )}
    {!rodando && resumo.falhas > 0 && (
      <Button type="button" variant="outline" onClick={onRetry}>
        Tentar de novo ({resumo.falhas})
      </Button>
    )}
    {!rodando && resumo.enviadas + resumo.falhas + resumo.canceladas > 0 && (
      <Button type="button" variant="ghost" className="ml-auto" onClick={onClear}>
        Limpar finalizadas
      </Button>
    )}
  </div>
);
