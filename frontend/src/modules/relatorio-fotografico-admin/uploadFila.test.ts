import { describe, expect, it } from 'vitest';
import { FOTO_MAX_BYTES } from '@/utils/foto';
import { filaReducer, prepararItens, proximoPendente, resumoFila, type UploadItem } from './uploadFila';

const arquivo = (nome: string, tamanho = 1024, modificado = 1) =>
  new File([new Uint8Array(Math.min(tamanho, 8))], nome, { type: 'image/jpeg', lastModified: modificado });

/** File de tamanho "grande" sem alocar: só a propriedade `size` muda. */
const arquivoGrande = (nome: string, size: number) => {
  const f = arquivo(nome);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

const contador = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const item = (id: string, status: UploadItem['status'], erro?: string): UploadItem => ({
  id,
  file: arquivo(`${id}.jpg`, 10, Number(id.length)),
  status,
  erro,
});

describe('prepararItens', () => {
  it('cria itens pendentes na ordem escolhida e recusa o que não é foto válida', () => {
    const { itens, recusados } = prepararItens(
      [],
      [arquivo('a.jpg'), arquivo('b.pdf'), arquivoGrande('c.png', FOTO_MAX_BYTES + 1), arquivo('d.webp')],
      0,
      contador(),
    );
    expect(itens.map((i) => [i.id, i.file.name, i.status])).toEqual([
      ['id-1', 'a.jpg', 'pendente'],
      ['id-2', 'd.webp', 'pendente'],
    ]);
    expect(recusados.map((r) => r.nome)).toEqual(['b.pdf', 'c.png']);
    expect(recusados[0]?.motivo).toMatch(/imagens/);
    expect(recusados[1]?.motivo).toMatch(/10 MB/);
  });

  it('respeita o limite de 100 contando as fotos que já existem e as da fila', () => {
    const fila = [item('x', 'pendente'), item('yy', 'enviando'), item('zzz', 'enviada')];
    // 97 no servidor + 2 esperando/enviando = 99: sobra 1 vaga (a enviada já conta no servidor).
    const { itens, recusados } = prepararItens(fila, [arquivo('a.jpg'), arquivo('b.jpg')], 97, contador());
    expect(itens.map((i) => i.file.name)).toEqual(['a.jpg']);
    expect(recusados).toEqual([{ nome: 'b.jpg', motivo: 'Limite de 100 fotos por relatório atingido.' }]);
  });

  it('relatório cheio recusa tudo', () => {
    const { itens, recusados } = prepararItens([], [arquivo('a.jpg')], 100, contador());
    expect(itens).toEqual([]);
    expect(recusados).toHaveLength(1);
  });

  it('recusa arquivo repetido (mesmo nome, tamanho e data) na fila e no próprio lote', () => {
    const novoId = contador();
    const primeiro = prepararItens([], [arquivo('a.jpg', 100, 5)], 0, novoId).itens;
    const { itens, recusados } = prepararItens(
      primeiro,
      [arquivo('a.jpg', 100, 5), arquivo('b.jpg', 100, 5), arquivo('b.jpg', 100, 5)],
      0,
      novoId,
    );
    expect(itens.map((i) => i.file.name)).toEqual(['b.jpg']);
    expect(recusados.map((r) => r.motivo)).toEqual([
      'Este arquivo já está na fila de envio.',
      'Este arquivo já está na fila de envio.',
    ]);
  });

  it('aceita de novo um arquivo que já foi enviado (o servidor não impede repetir)', () => {
    const fila: UploadItem[] = [{ id: 'q', file: arquivo('a.jpg', 100, 5), status: 'enviada' }];
    expect(prepararItens(fila, [arquivo('a.jpg', 100, 5)], 1, contador()).itens).toHaveLength(1);
  });
});

describe('filaReducer', () => {
  const fila = [
    item('a', 'enviada'),
    item('b', 'erro', 'Arquivo vazio.'),
    item('c', 'pendente'),
    item('d', 'enviando'),
  ];

  it('troca o status de um item e limpa o erro anterior', () => {
    const depois = filaReducer(fila, { tipo: 'status', id: 'b', status: 'enviando' });
    expect(depois.find((i) => i.id === 'b')).toMatchObject({ status: 'enviando', erro: undefined });
  });

  it('registra a mensagem de erro', () => {
    const depois = filaReducer(fila, { tipo: 'status', id: 'd', status: 'erro', erro: 'Limite' });
    expect(depois.find((i) => i.id === 'd')).toMatchObject({ status: 'erro', erro: 'Limite' });
  });

  it('cancelar só mexe nos pendentes (o que está sendo enviado termina)', () => {
    const depois = filaReducer(fila, { tipo: 'cancelar' });
    expect(depois.map((i) => i.status)).toEqual(['enviada', 'erro', 'cancelada', 'enviando']);
  });

  it('repetir volta as falhas para pendente sem a mensagem', () => {
    const depois = filaReducer(fila, { tipo: 'repetir' });
    expect(depois.map((i) => i.status)).toEqual(['enviada', 'pendente', 'pendente', 'enviando']);
    expect(depois.find((i) => i.id === 'b')?.erro).toBeUndefined();
  });

  it('remover tira um item, menos o que está sendo enviado', () => {
    expect(filaReducer(fila, { tipo: 'remover', id: 'c' }).map((i) => i.id)).toEqual(['a', 'b', 'd']);
    expect(filaReducer(fila, { tipo: 'remover', id: 'd' }).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('limpar mantém só pendentes e em envio', () => {
    expect(filaReducer(fila, { tipo: 'limpar' }).map((i) => i.id)).toEqual(['c', 'd']);
  });

  it('não altera a fila recebida', () => {
    const copia = fila.map((i) => ({ ...i }));
    filaReducer(fila, { tipo: 'cancelar' });
    expect(fila).toEqual(copia);
  });
});

describe('proximoPendente e resumoFila', () => {
  it('pega o primeiro pendente, na ordem da fila', () => {
    expect(proximoPendente([item('a', 'enviada'), item('b', 'pendente'), item('c', 'pendente')])?.id).toBe('b');
    expect(proximoPendente([item('a', 'enviada')])).toBeUndefined();
  });

  it('conta por status e calcula o progresso do que já foi resolvido', () => {
    const resumo = resumoFila([
      item('a', 'enviada'),
      item('b', 'enviada'),
      item('c', 'erro', 'x'),
      item('d', 'cancelada'),
      item('e', 'enviando'),
      item('f', 'pendente'),
      item('g', 'pendente'),
      item('h', 'pendente'),
    ]);
    expect(resumo).toEqual({
      total: 8,
      pendentes: 3,
      enviando: 1,
      enviadas: 2,
      falhas: 1,
      canceladas: 1,
      progresso: 50,
    });
  });

  it('fila vazia = progresso 0', () => {
    expect(resumoFila([]).progresso).toBe(0);
  });
});
