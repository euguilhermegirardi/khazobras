import { Button } from '@/components/ui/button';

interface SelecaoBarraProps {
  quantidade: number;
  /** Lote em andamento: trava os botões. */
  ocupado: boolean;
  onLiberar: () => void;
  onOcultar: () => void;
  onLimpar: () => void;
}

/** Barra de ações em lote: aparece com 1+ lançamentos marcados na página. */
export const SelecaoBarra = ({ quantidade, ocupado, onLiberar, onOcultar, onLimpar }: SelecaoBarraProps) => (
  <div
    role="region"
    aria-label="Ações em lote"
    className="flex flex-wrap items-center gap-3 rounded-md border border-info/25 bg-info-soft px-3.5 py-2 text-[13px] text-info-soft-foreground"
  >
    <span className="font-medium">{quantidade === 1 ? '1 selecionado' : `${quantidade} selecionados`}</span>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" disabled={ocupado} onClick={onLiberar}>
        Liberar ao cliente
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={onOcultar}>
        Ocultar do cliente
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={onLimpar}>
        Limpar seleção
      </Button>
    </div>
  </div>
);
