import { render, screen, within } from '@testing-library/react';
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

  it('na pré-visualização, HTML, links e imagens do texto não viram elementos', async () => {
    render(<Campo inicial={'<script>x</script> [a](javascript:alert(1)) ![f](x.png) <img src=x onerror=alert(1)>'} />);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pré-visualizar' }));

    const painel = screen.getByRole('tabpanel', { name: 'Pré-visualizar' });
    expect(painel.querySelector('script, a, img, [onerror]')).toBeNull();
    expect(painel).toHaveTextContent('<script>x</script>');
  });
});
