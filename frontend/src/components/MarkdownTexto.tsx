import Markdown, { type Components } from 'react-markdown';
import { cn } from '@/utils/cn';

interface MarkdownTextoProps {
  /** Markdown simples vindo da API (ou texto puro de relatórios antigos). */
  conteudo: string;
  className?: string;
}

/**
 * Elementos que podem aparecer. `h1` e `h4`-`h6` entram só para serem remapeados (a página já tem h1; o relatório
 * usa h2/h3). Todo o resto (link, imagem, código, tabela, citação...) vira texto simples (`unwrapDisallowed`).
 */
const ELEMENTOS_PERMITIDOS = ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];

const TITULO_2 = 'mt-4 mb-1 text-sm font-semibold first:mt-0';
const TITULO_3 = 'mt-3 mb-1 text-[13px] font-semibold first:mt-0';

// `whitespace-pre-line` em p/li: a quebra de linha simples do texto antigo continua visível (Markdown a juntaria).
const COMPONENTES: Components = {
  p: ({ node: _node, ...props }) => <p className="whitespace-pre-line [&:not(:first-child)]:mt-2" {...props} />,
  h1: ({ node: _node, children, ...props }) => (
    <h2 className={TITULO_2} {...props}>
      {children}
    </h2>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2 className={TITULO_2} {...props}>
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 className={TITULO_3} {...props}>
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h3 className={TITULO_3} {...props}>
      {children}
    </h3>
  ),
  h5: ({ node: _node, children, ...props }) => (
    <h3 className={TITULO_3} {...props}>
      {children}
    </h3>
  ),
  h6: ({ node: _node, children, ...props }) => (
    <h3 className={TITULO_3} {...props}>
      {children}
    </h3>
  ),
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc pl-5 first:mt-0" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal pl-5 first:mt-0" {...props} />,
  li: ({ node: _node, ...props }) => <li className="whitespace-pre-line [&:not(:first-child)]:mt-0.5" {...props} />,
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node: _node, ...props }) => <em className="italic" {...props} />,
};

/**
 * Renderiza o texto do relatório (Markdown simples) sem nunca montar HTML do usuário: sem `rehype-raw` (HTML cru
 * aparece como texto), só os elementos acima, sem links nem imagens e sem `dangerouslySetInnerHTML`.
 * Usado na tela do cliente, no detalhe do admin e na pré-visualização do editor.
 */
export const MarkdownTexto = ({ conteudo, className }: MarkdownTextoProps) => (
  <div className={cn('text-[13px] leading-relaxed [overflow-wrap:anywhere]', className)}>
    <Markdown allowedElements={ELEMENTOS_PERMITIDOS} unwrapDisallowed components={COMPONENTES}>
      {conteudo}
    </Markdown>
  </div>
);
