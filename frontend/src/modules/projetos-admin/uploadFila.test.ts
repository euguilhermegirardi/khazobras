import { describe, expect, it } from 'vitest';
import { PROJETO_MAX_BYTES } from './projetoRegras';
import { prepararItens } from './uploadFila';

const arquivo = (nome: string, modificado = 1) => new File(['x'], nome, { lastModified: modificado });
const grande = (nome: string) => {
  const f = arquivo(nome);
  Object.defineProperty(f, 'size', { value: PROJETO_MAX_BYTES + 1 });
  return f;
};
const contador = () => {
  let n = 0;
  return () => `id-${++n}`;
};

describe('prepararItens (documentos)', () => {
  it('põe na fila na ordem escolhida e recusa tipo, tamanho e barra no nome', () => {
    const { itens, recusados } = prepararItens(
      [],
      [arquivo('a.pdf'), arquivo('b.txt'), grande('c.pdf'), arquivo('d\\e.pdf'), arquivo('f.xlsx')],
      0,
      contador(),
    );
    expect(itens.map((i) => i.file.name)).toEqual(['a.pdf', 'f.xlsx']);
    expect(recusados.map((r) => r.nome)).toEqual(['b.txt', 'c.pdf', 'd\\e.pdf']);
    expect(recusados[0]?.motivo).toMatch(/Tipo de arquivo não permitido/);
  });

  it('respeita o limite de 200 por obra contando o servidor e a fila', () => {
    const { itens, recusados } = prepararItens([], [arquivo('a.pdf'), arquivo('b.pdf')], 199, contador());
    expect(itens.map((i) => i.file.name)).toEqual(['a.pdf']);
    expect(recusados).toEqual([{ nome: 'b.pdf', motivo: 'Limite de 200 documentos por obra atingido.' }]);
  });

  it('obra cheia recusa tudo; arquivo repetido na fila é recusado', () => {
    expect(prepararItens([], [arquivo('a.pdf')], 200, contador()).itens).toEqual([]);
    const primeiro = prepararItens([], [arquivo('a.pdf', 5)], 0, contador()).itens;
    const { itens, recusados } = prepararItens(primeiro, [arquivo('a.pdf', 5)], 0, contador());
    expect(itens).toEqual([]);
    expect(recusados[0]?.motivo).toBe('Este arquivo já está na fila de envio.');
  });
});
