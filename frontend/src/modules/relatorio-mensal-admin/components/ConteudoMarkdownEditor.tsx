import { type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';
import { MarkdownTexto } from '@/components/MarkdownTexto';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { aplicarFormato, type FormatoMarkdown } from '../markdownEdicao';
import { MarkdownBarra } from './MarkdownBarra';

interface ConteudoMarkdownEditorProps {
  id: string;
  name: string;
  /** Markdown cru: é o que o formulário valida, conta e envia. */
  value: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  /** Ref do campo (react-hook-form, para focar no primeiro erro). */
  inputRef: (elemento: HTMLTextAreaElement | null) => void;
  placeholder: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

type Aba = 'escrever' | 'previa';

const ATALHOS: Record<string, FormatoMarkdown> = { b: 'negrito', i: 'italico' };

/**
 * Campo "Conteúdo": abas Escrever | Pré-visualizar. Em "Escrever", barra de formatação (Markdown simples) + textarea
 * com Ctrl/Cmd+B e Ctrl/Cmd+I; em "Pré-visualizar", o texto renderizado como o cliente verá. O textarea fica montado
 * nas duas abas (a seleção e o rótulo continuam valendo ao voltar).
 */
export const ConteudoMarkdownEditor = ({
  id,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  placeholder,
  'aria-invalid': invalido,
  'aria-describedby': descritoPor,
}: ConteudoMarkdownEditorProps) => {
  // Estados
  const [aba, setAba] = useState<Aba>('escrever');
  // Hooks
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  // Seleção a restaurar depois que o React aplicar o novo texto (o textarea controlado leva o cursor ao fim).
  const selecaoPendente = useRef<{ inicio: number; fim: number } | null>(null);

  // Functions
  const handleRef = (elemento: HTMLTextAreaElement | null) => {
    areaRef.current = elemento;
    inputRef(elemento);
  };

  const formatar = (formato: FormatoMarkdown) => {
    const area = areaRef.current;
    if (!area) return;
    const resultado = aplicarFormato({ texto: value, inicio: area.selectionStart, fim: area.selectionEnd }, formato);
    if (resultado.texto === value) {
      area.focus();
      area.setSelectionRange(resultado.inicio, resultado.fim);
      return;
    }
    selecaoPendente.current = { inicio: resultado.inicio, fim: resultado.fim };
    onChange(resultado.texto);
  };

  const handleKeyDown = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.shiftKey) return;
    const formato = ATALHOS[evento.key.toLowerCase()];
    if (!formato) return;
    evento.preventDefault();
    formatar(formato);
  };

  const handleAba = (valor: string) => setAba(valor === 'previa' ? 'previa' : 'escrever');

  // Effects
  useLayoutEffect(() => {
    const selecao = selecaoPendente.current;
    const area = areaRef.current;
    if (!selecao || !area) return;
    selecaoPendente.current = null;
    area.focus();
    area.setSelectionRange(selecao.inicio, selecao.fim);
  }, [value]);

  // Return
  return (
    <Tabs value={aba} onValueChange={handleAba} className="gap-2">
      <TabsList aria-label="Modo do conteúdo">
        <TabsTrigger value="escrever">Escrever</TabsTrigger>
        <TabsTrigger value="previa">Pré-visualizar</TabsTrigger>
      </TabsList>

      <TabsContent value="escrever" forceMount tabIndex={-1} className="data-[state=inactive]:hidden">
        <MarkdownBarra desabilitado={aba !== 'escrever'} onFormatar={formatar} />
        <Textarea
          id={id}
          name={name}
          ref={handleRef}
          value={value}
          rows={14}
          className="min-h-64 resize-y rounded-t-none"
          placeholder={placeholder}
          aria-invalid={invalido}
          aria-describedby={descritoPor}
          onChange={(evento) => onChange(evento.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
      </TabsContent>

      <TabsContent value="previa">
        <div className="min-h-64 rounded-md border border-input bg-card px-3 py-2">
          {value.trim() === '' ? (
            <p className="text-[13px] text-muted-foreground">
              Nada para mostrar ainda. Escreva o texto na aba Escrever.
            </p>
          ) : (
            <MarkdownTexto conteudo={value} />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
};
