import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ConteudoMarkdownEditor } from './ConteudoMarkdownEditor';

/** Controla o valor como o formulário faz; `aoMudar` guarda o último valor para as conferências. */
const Campo = ({ inicial = '', aoMudar }: { inicial?: string; aoMudar?: (valor: string) => void }) => {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="conteudo">Conteúdo</label>
      <ConteudoMarkdownEditor
        id="conteudo"
        name="conteudo"
        value={valor}
        onChange={(novo) => {
          setValor(novo);
          aoMudar?.(novo);
        }}
        onBlur={() => undefined}
        inputRef={() => undefined}
        placeholder="Escreva aqui"
        aria-invalid={false}
        aria-describedby={undefined}
      />
    </>
  );
};

const area = () => screen.getByLabelText('Conteúdo') as HTMLTextAreaElement;
const botao = (nome: string) => screen.getByRole('button', { name: nome });

/** Foca o textarea e seleciona `[inicio, fim)`, como o usuário faria antes de clicar num botão. */
const selecionar = (inicio: number, fim = inicio) => {
  area().focus();
  area().setSelectionRange(inicio, fim);
};

describe('ConteudoMarkdownEditor', () => {
  it('mostra a barra com os cinco botões acessíveis (type=button, nome em português e dica)', () => {
    render(<Campo />);

    const barra = screen.getByRole('toolbar', { name: 'Formatação do texto' });
    const nomes = within(barra)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(nomes).toEqual(['Negrito', 'Itálico', 'Título', 'Lista', 'Lista numerada']);
    for (const b of within(barra).getAllByRole('button')) {
      expect(b).toHaveAttribute('type', 'button');
      expect(b).toHaveAttribute('title');
    }
    expect(botao('Negrito')).toHaveAttribute('title', 'Negrito (Ctrl+B)');
  });

  it('negrito com seleção envolve o trecho e mantém foco e seleção no textarea', async () => {
    render(<Campo inicial="Obra concluída hoje" />);
    selecionar(5, 14);

    await userEvent.setup().click(botao('Negrito'));

    expect(area()).toHaveValue('Obra **concluída** hoje');
    expect(area()).toHaveFocus();
    expect([area().selectionStart, area().selectionEnd]).toEqual([7, 16]);
  });

  it('clicar de novo desfaz (alterna) e a seleção continua sobre o trecho', async () => {
    render(<Campo inicial="Obra concluída hoje" />);
    selecionar(5, 14);
    const u = userEvent.setup();

    await u.click(botao('Negrito'));
    await u.click(botao('Negrito'));

    expect(area()).toHaveValue('Obra concluída hoje');
    expect(area()).toHaveFocus();
    expect([area().selectionStart, area().selectionEnd]).toEqual([5, 14]);
  });

  it('itálico sem seleção insere o par e deixa o cursor no meio; digitar continua ali', async () => {
    render(<Campo inicial="Texto " />);
    selecionar(6);
    const u = userEvent.setup();

    await u.click(botao('Itálico'));
    expect(area()).toHaveValue('Texto **');
    expect(area().selectionStart).toBe(7);
    expect(area()).toHaveFocus();

    await u.keyboard('ok');
    expect(area()).toHaveValue('Texto *ok*');
  });

  it('título e listas prefixam a linha do cursor', async () => {
    render(<Campo inicial={'Resumo\nPisos\nTelhado'} />);
    const u = userEvent.setup();

    selecionar(2);
    await u.click(botao('Título'));
    expect(area()).toHaveValue('## Resumo\nPisos\nTelhado');

    selecionar(area().value.indexOf('Pisos') + 1);
    await u.click(botao('Lista'));
    expect(area()).toHaveValue('## Resumo\n- Pisos\nTelhado');

    selecionar(area().value.indexOf('Telhado') + 1);
    await u.click(botao('Lista numerada'));
    expect(area()).toHaveValue('## Resumo\n- Pisos\n1. Telhado');
    expect(area()).toHaveFocus();
  });

  it('lista numerada em várias linhas selecionadas numera todas e mantém a seleção do bloco', async () => {
    render(<Campo inicial={'um\ndois\ntrês'} />);
    selecionar(0, 12);

    await userEvent.setup().click(botao('Lista numerada'));

    expect(area()).toHaveValue('1. um\n2. dois\n3. três');
    expect([area().selectionStart, area().selectionEnd]).toEqual([0, 21]);
  });

  it('Ctrl+B e Ctrl+I formatam a seleção; Cmd+B também; outros atalhos passam direto', async () => {
    render(<Campo inicial="alpha beta gama" />);
    const u = userEvent.setup();

    selecionar(0, 5);
    await u.keyboard('{Control>}b{/Control}');
    expect(area()).toHaveValue('**alpha** beta gama');

    selecionar(10, 14);
    await u.keyboard('{Control>}i{/Control}');
    expect(area()).toHaveValue('**alpha** *beta* gama');

    selecionar(area().value.indexOf('gama'), area().value.length);
    await u.keyboard('{Meta>}b{/Meta}');
    expect(area()).toHaveValue('**alpha** *beta* **gama**');

    // Ctrl+U (sublinhado) não faz nada: não existe no editor.
    selecionar(0, 2);
    await u.keyboard('{Control>}u{/Control}');
    expect(area()).toHaveValue('**alpha** *beta* **gama**');
  });

  it('o atalho não "digita" a letra e mantém o foco', async () => {
    render(<Campo inicial="x" />);
    selecionar(0, 1);

    await userEvent.setup().keyboard('{Control>}b{/Control}');

    expect(area()).toHaveValue('**x**');
    expect(area()).toHaveFocus();
  });

  it('os botões são alcançáveis pelo teclado (Tab) e acionáveis com Enter', async () => {
    render(<Campo inicial="texto" />);
    const u = userEvent.setup();
    selecionar(0, 5);

    // Da aba "Escrever", o Tab seguinte cai direto no primeiro botão (o painel não é uma parada extra).
    await u.click(screen.getByRole('tab', { name: 'Pré-visualizar' }));
    await u.click(screen.getByRole('tab', { name: 'Escrever' }));
    await u.tab();
    expect(botao('Negrito')).toHaveFocus();
    await u.keyboard('{Enter}');

    expect(area()).toHaveValue('**texto**');
    expect(area()).toHaveFocus();
  });

  it('avisa o formulário a cada mudança com o texto Markdown cru', async () => {
    const valores: string[] = [];
    render(<Campo aoMudar={(v) => valores.push(v)} />);

    await userEvent.setup().type(area(), 'oi');
    selecionar(0, 2);
    await userEvent.setup().click(botao('Negrito'));

    expect(valores.at(-1)).toBe('**oi**');
  });

  it('"Pré-visualizar" mostra o Markdown renderizado, desliga a barra e "Escrever" volta ao texto', async () => {
    render(<Campo inicial={'## Resumo\n\nObra **adiantada**\n\n- Laje'} />);
    const u = userEvent.setup();

    await u.click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(within(painel).getByRole('heading', { level: 2, name: 'Resumo' })).toBeInTheDocument();
    expect(painel.querySelector('strong')).toHaveTextContent('adiantada');
    expect(within(painel).getByRole('listitem')).toHaveTextContent('Laje');
    for (const b of screen.getAllByRole('button', { hidden: true })) expect(b).toBeDisabled();

    await u.click(screen.getByRole('tab', { name: 'Escrever' }));
    expect(area()).toBeVisible();
    expect(area()).toHaveValue('## Resumo\n\nObra **adiantada**\n\n- Laje');
    expect(botao('Negrito')).toBeEnabled();
  });

  it('pré-visualização vazia explica o que fazer', async () => {
    render(<Campo />);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    expect(screen.getByText(/Nada para mostrar ainda/)).toBeInTheDocument();
  });

  it('pré-visualização com só espaços e quebras de linha também mostra o aviso de vazio', async () => {
    render(<Campo inicial={'  \n\n \t '} />);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    expect(screen.getByText(/Nada para mostrar ainda/)).toBeInTheDocument();
  });

  it('trocar de aba várias vezes não perde o texto e a barra volta a formatar a seleção', async () => {
    const valores: string[] = [];
    render(<Campo inicial="Obra concluída hoje" aoMudar={(v) => valores.push(v)} />);
    const u = userEvent.setup();
    selecionar(5, 14);

    for (let i = 0; i < 3; i += 1) {
      await u.click(screen.getByRole('tab', { name: 'Pré-visualizar' }));
      expect(screen.getByRole('tabpanel', { name: 'Pré-visualizar' })).toHaveTextContent('Obra concluída hoje');
      await u.click(screen.getByRole('tab', { name: 'Escrever' }));
      expect(area()).toHaveValue('Obra concluída hoje');
    }
    expect(valores).toEqual([]);

    selecionar(5, 14);
    await u.click(botao('Negrito'));
    expect(area()).toHaveValue('Obra **concluída** hoje');
  });

  it('clicar na barra não tira o foco do textarea (mousedown sem ação padrão)', () => {
    render(<Campo inicial="texto" />);
    selecionar(0, 5);

    for (const nome of ['Negrito', 'Itálico', 'Título', 'Lista', 'Lista numerada']) {
      // `fireEvent` devolve `false` quando o evento foi cancelado (preventDefault): o navegador não move o foco.
      expect(fireEvent.mouseDown(botao(nome)), nome).toBe(false);
    }
    expect(area()).toHaveFocus();
  });

  it('botão com o textarea sem foco: foca o campo e formata o texto', async () => {
    render(<Campo inicial="texto" />);
    expect(area()).not.toHaveFocus();

    await userEvent.setup().click(botao('Lista'));

    expect(area()).toHaveValue('- texto');
    expect(area()).toHaveFocus();
  });

  it('seleção no meio da palavra: clique mantém foco e seleção exatamente sobre o trecho', async () => {
    render(<Campo inicial="concluída" />);
    selecionar(3, 6);

    await userEvent.setup().click(botao('Itálico'));

    expect(area()).toHaveValue('con*clu*ída');
    expect(area()).toHaveFocus();
    expect([area().selectionStart, area().selectionEnd]).toEqual([4, 7]);
  });

  it('emoji selecionado: a seleção volta sobre o emoji (índices UTF-16)', async () => {
    render(<Campo inicial="obra 😀 ok" />);
    selecionar(5, 7);

    await userEvent.setup().click(botao('Negrito'));

    expect(area()).toHaveValue('obra **😀** ok');
    expect(area().value.slice(area().selectionStart, area().selectionEnd)).toBe('😀');
  });

  it('Ctrl+B duas vezes na mesma seleção volta ao texto original e mantém a seleção', async () => {
    render(<Campo inicial="alpha beta" />);
    selecionar(0, 5);
    const u = userEvent.setup();

    await u.keyboard('{Control>}b{/Control}');
    await u.keyboard('{Control>}b{/Control}');

    expect(area()).toHaveValue('alpha beta');
    expect([area().selectionStart, area().selectionEnd]).toEqual([0, 5]);
  });

  it('Ctrl+Shift+B, Ctrl+Alt+B (AltGr) e B sozinho não formatam; Ctrl+B com CapsLock (B maiúsculo) formata', () => {
    render(<Campo inicial="alpha" />);
    selecionar(0, 5);

    const semShift = fireEvent.keyDown(area(), { key: 'B', ctrlKey: true, shiftKey: true });
    const altGr = fireEvent.keyDown(area(), { key: 'b', ctrlKey: true, altKey: true });
    const sozinho = fireEvent.keyDown(area(), { key: 'b' });
    // Eventos ignorados não têm o padrão cancelado (o navegador continua com o que faria).
    expect([semShift, altGr, sozinho]).toEqual([true, true, true]);
    expect(area()).toHaveValue('alpha');

    // CapsLock ligado: `key` vem maiúscula, sem Shift.
    fireEvent.keyDown(area(), { key: 'B', ctrlKey: true });
    expect(area()).toHaveValue('**alpha**');
  });

  it('Ctrl+B sem seleção insere o par e o texto digitado em seguida fica em negrito', async () => {
    render(<Campo inicial="" />);
    const u = userEvent.setup();
    selecionar(0);

    await u.keyboard('{Control>}b{/Control}');
    await u.keyboard('forte');

    expect(area()).toHaveValue('**forte**');
  });

  it('colar texto com marcadores e linhas misturadas não é alterado pela barra até haver clique', async () => {
    render(<Campo />);
    const u = userEvent.setup();
    area().focus();

    await u.paste('# a\r\n- b\r\n**c**');

    expect(area().value.replace(/\r\n/g, '\n')).toBe('# a\n- b\n**c**');
  });

  it('na pré-visualização, HTML, links e imagens do texto não viram elementos', async () => {
    render(<Campo inicial={'<script>x</script> [a](javascript:alert(1)) ![f](x.png) <img src=x onerror=alert(1)>'} />);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(painel.querySelector('script, a, img, [onerror]')).toBeNull();
    expect(painel).toHaveTextContent('<script>x</script>');
  });
});
