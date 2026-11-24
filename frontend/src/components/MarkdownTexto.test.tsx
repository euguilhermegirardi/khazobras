import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownTexto } from './MarkdownTexto';

describe('MarkdownTexto', () => {
  it('renderiza negrito, itálico, listas e títulos', () => {
    const { container } = render(
      <MarkdownTexto
        conteudo={
          '## Resumo\n\nObra **adiantada** e *sem* atrasos.\n\n- Fundação\n- Laje\n\n1. Pintar\n2. Entregar\n\n### Próximos'
        }
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Próximos' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('adiantada');
    expect(container.querySelector('em')).toHaveTextContent('sem');
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(container.querySelector('ul')).toHaveTextContent('Fundação Laje');
    expect(container.querySelector('ol')).toHaveTextContent('Pintar Entregar');
  });

  it('nunca gera h1: "#" vira h2 e "####" vira h3', () => {
    const { container } = render(<MarkdownTexto conteudo={'# Grande\n\n#### Pequeno'} />);

    expect(container.querySelector('h1')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Pequeno' })).toBeInTheDocument();
  });

  it('texto antigo sem marcação aparece igual, com as quebras de linha simples preservadas', () => {
    const { container } = render(<MarkdownTexto conteudo={'Linha 1\nLinha 2\n\nOutro parágrafo'} />);

    const paragrafos = container.querySelectorAll('p');
    expect(paragrafos).toHaveLength(2);
    // O texto fica com o "\n" (o CSS `whitespace-pre-line` o mostra como quebra).
    expect(paragrafos[0]?.textContent).toBe('Linha 1\nLinha 2');
    expect(paragrafos[1]?.textContent).toBe('Outro parágrafo');
  });

  it('não monta script, HTML cru, link nem imagem: tudo vira texto ou some', () => {
    const conteudo = [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(2)">',
      '<b onclick="x()">cru</b>',
      '[clique](javascript:alert(3))',
      '[site](https://exemplo.com)',
      '![foto](https://exemplo.com/a.png)',
      '<a href="https://exemplo.com">html</a>',
      '`codigo`',
      '> citação',
      '| a | b |\n|---|---|\n| 1 | 2 |',
    ].join('\n\n');
    const { container } = render(<MarkdownTexto conteudo={conteudo} />);

    for (const tag of ['script', 'img', 'a', 'b', 'code', 'pre', 'blockquote', 'table', 'iframe']) {
      expect(container.querySelector(tag), tag).toBeNull();
    }
    expect(container.querySelector('[onerror], [onclick], [href], [src]')).toBeNull();
    // O texto do link continua legível, sem o endereço virar link.
    expect(container).toHaveTextContent('clique');
    expect(container).toHaveTextContent('site');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // O HTML cru aparece como texto, não como elemento.
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });

  it('linha longa sem espaço é renderizada inteira', () => {
    const longo = 'x'.repeat(20000);
    const { container } = render(<MarkdownTexto conteudo={longo} />);

    expect(container.textContent).toContain(longo);
  });
});

const TAGS_PERMITIDAS = new Set(['DIV', 'P', 'BR', 'STRONG', 'EM', 'H2', 'H3', 'UL', 'OL', 'LI']);

/** Invariante de segurança: só os elementos do relatório e nenhum atributo além de `class`. */
function conferirSoElementosSeguros(container: HTMLElement) {
  for (const elemento of container.querySelectorAll('*')) {
    expect(TAGS_PERMITIDAS.has(elemento.tagName), `<${elemento.tagName.toLowerCase()}> não deveria existir`).toBe(true);
    for (const atributo of elemento.getAttributeNames()) {
      expect(atributo, `atributo ${atributo} em <${elemento.tagName.toLowerCase()}>`).toBe('class');
    }
  }
}

describe('MarkdownTexto - conteúdo hostil', () => {
  const hostis: Record<string, string> = {
    script: '<script>alert(1)</script>',
    'script em maiúsculas': '<SCRIPT SRC=//x.js></SCRIPT>',
    'img onerror': '<img src=x onerror=alert(1)>',
    iframe: '<iframe src="https://evil.example"></iframe>',
    svg: '<svg onload=alert(1)><circle/></svg>',
    style: '<style>body{display:none}</style>',
    'a href html': '<a href="javascript:alert(1)">x</a>',
    'comentário e details': '<!-- x --><details open ontoggle=alert(1)><summary>s</summary></details>',
    'link javascript': '[x](javascript:alert(1))',
    'link javascript com espaço': '[x]( javascript:alert(1) )',
    'link data': '[x](data:text/html;base64,PHNjcmlwdD4=)',
    'link por referência': '[x][r]\n\n[r]: javascript:alert(1)',
    autolink: '<https://evil.example> <javascript:alert(1)>',
    'imagem remota': '![i](http://x/y.png)',
    'imagem por referência': '![i][r]\n\n[r]: http://x/y.png',
    'imagem com título': '![i](http://x/y.png "t")',
    código: '```js\nalert(1)\n```\n\n`x`\n\n    recuado',
    citação: '> a\n> > b',
    tabela: '| a | b |\n|---|---|\n| 1 | 2 |',
    'régua e setext': '---\n\nTítulo\n=====\n\nOutro\n-----',
    entidades: '&lt;script&gt;alert(1)&lt;/script&gt; &#60;b&#62; &amp;',
    'footnote e html bloco': '<div onclick=alert(1)>\n\n**x**\n\n</div>',
  };

  for (const [nome, markdown] of Object.entries(hostis)) {
    it(`${nome}: só elementos permitidos e sem atributos perigosos`, () => {
      const { container } = render(<MarkdownTexto conteudo={markdown} />);

      conferirSoElementosSeguros(container);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  }

  it('HTML cru e entidades aparecem como texto literal, não como elementos', () => {
    const { container } = render(
      <MarkdownTexto conteudo={'<iframe src="x"></iframe>\n\n&lt;b&gt;x&lt;/b&gt; &amp; &#60;i&#62;'} />,
    );

    expect(container).toHaveTextContent('<iframe src="x"></iframe>');
    expect(container).toHaveTextContent('<b>x</b> & <i>');
    expect(container.querySelector('iframe, b, i')).toBeNull();
  });

  it('link e imagem mostram o texto, mas nunca o endereço como link ou fonte', () => {
    const { container } = render(
      <MarkdownTexto conteudo={'[clique aqui](javascript:alert(1)) ![foto](http://x/y.png)'} />,
    );

    expect(container).toHaveTextContent('clique aqui');
    expect(container.querySelector('[href], [src]')).toBeNull();
  });

  it('nunca gera h1, h4, h5 nem h6: "#" e setext viram h2; "####" ou mais viram h3', () => {
    const { container } = render(
      <MarkdownTexto conteudo={'# a\n\nTítulo setext\n===\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f'} />,
    );

    expect(container.querySelector('h1, h4, h5, h6')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['a', 'Título setext', 'b']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['c', 'd', 'e', 'f']);
  });

  it('"#" sem espaço e "#" no meio da linha são texto comum', () => {
    const { container } = render(<MarkdownTexto conteudo={'#semespaco e item #3'} />);

    expect(container.querySelector('h1, h2, h3')).toBeNull();
    expect(container).toHaveTextContent('#semespaco e item #3');
  });

  it('negrito e itálico no meio da palavra (o que o botão gera) renderizam', () => {
    const { container } = render(<MarkdownTexto conteudo={'con**clu**ída e con*clu*ída e **a *b* c**'} />);

    expect(container.querySelectorAll('strong')).toHaveLength(2);
    expect(container.querySelectorAll('em')).toHaveLength(2);
    expect(container).toHaveTextContent('concluída e concluída e a b c');
  });

  it('texto antigo: quebras simples, \\r\\n e linhas em branco extras continuam visíveis', () => {
    const { container } = render(<MarkdownTexto conteudo={'Linha 1\r\nLinha 2\r\n\r\n\r\n\r\nOutro'} />);

    const paragrafos = container.querySelectorAll('p');
    expect(paragrafos).toHaveLength(2);
    // `whitespace-pre-line` trata "\r\n" como uma quebra só; o que importa é não haver linha engolida.
    expect(paragrafos[0]?.textContent?.replace('\r\n', '\n')).toBe('Linha 1\nLinha 2');
    expect(paragrafos[1]?.textContent).toBe('Outro');
  });

  it('quebra forçada (dois espaços no fim da linha) vira <br>', () => {
    const { container } = render(<MarkdownTexto conteudo={'a  \nb'} />);

    expect(container.querySelector('br')).not.toBeNull();
  });

  it('lista com número seguido de ")" e lista com "+" também são listas', () => {
    const { container } = render(<MarkdownTexto conteudo={'1) a\n2) b\n\n+ c\n+ d'} />);

    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
  });

  it('1000 parágrafos com formatação (cerca de 17 mil caracteres) renderizam todos', () => {
    const md = Array.from({ length: 1000 }, (_, i) => `item **${i}** *x*`).join('\n\n');
    expect(md.length).toBeLessThan(20000);
    const { container } = render(<MarkdownTexto conteudo={md} />);

    expect(container.querySelectorAll('p')).toHaveLength(1000);
    expect(container.querySelectorAll('strong')).toHaveLength(1000);
  });

  it('20000 caracteres de sintaxe quebrada (asteriscos, colchetes, tags) renderizam sem exceção', () => {
    for (const entrada of [
      '*'.repeat(20000),
      '['.repeat(20000),
      '<div>'.repeat(4000),
      '_'.repeat(20000),
      '!['.repeat(10000),
    ]) {
      const { container, unmount } = render(<MarkdownTexto conteudo={entrada} />);
      conferirSoElementosSeguros(container);
      unmount();
    }
  });

  it('só "****" (negrito vazio) não quebra a renderização', () => {
    const { container } = render(<MarkdownTexto conteudo="****" />);

    conferirSoElementosSeguros(container);
  });
});
