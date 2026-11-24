import { Bold, Heading2, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { FormatoMarkdown } from '../markdownEdicao';

interface MarkdownBarraProps {
  /** Desligada na aba de pré-visualização (não há texto para formatar). */
  desabilitado: boolean;
  onFormatar: (formato: FormatoMarkdown) => void;
}

interface Ferramenta {
  formato: FormatoMarkdown;
  rotulo: string;
  dica: string;
  /** Atalho de teclado (`aria-keyshortcuts`); só negrito e itálico têm. */
  atalho?: string;
  Icone: LucideIcon;
}

const FERRAMENTAS: Ferramenta[] = [
  { formato: 'negrito', rotulo: 'Negrito', dica: 'Negrito (Ctrl+B)', atalho: 'Control+B Meta+B', Icone: Bold },
  { formato: 'italico', rotulo: 'Itálico', dica: 'Itálico (Ctrl+I)', atalho: 'Control+I Meta+I', Icone: Italic },
  { formato: 'titulo', rotulo: 'Título', dica: 'Título', Icone: Heading2 },
  { formato: 'lista', rotulo: 'Lista', dica: 'Lista com marcadores', Icone: List },
  { formato: 'numerada', rotulo: 'Lista numerada', dica: 'Lista numerada', Icone: ListOrdered },
];

/**
 * Barra de formatação acima do textarea do conteúdo. O clique não tira o foco nem a seleção do textarea
 * (`mousedown` sem ação padrão); quem aplica o formato e devolve o foco é o editor.
 */
export const MarkdownBarra = ({ desabilitado, onFormatar }: MarkdownBarraProps) => {
  // Functions
  const handleMouseDown = (evento: MouseEvent<HTMLButtonElement>) => evento.preventDefault();

  // Return
  return (
    <div
      role="toolbar"
      aria-label="Formatação do texto"
      className="flex items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted px-2 py-1.5"
    >
      {FERRAMENTAS.map(({ formato, rotulo, dica, atalho, Icone }) => (
        <Button
          key={formato}
          type="button"
          size="icon"
          variant="outline"
          className="size-7"
          aria-label={rotulo}
          aria-keyshortcuts={atalho}
          title={dica}
          disabled={desabilitado}
          onMouseDown={handleMouseDown}
          onClick={() => onFormatar(formato)}
        >
          <Icone aria-hidden />
        </Button>
      ))}
    </div>
  );
};
