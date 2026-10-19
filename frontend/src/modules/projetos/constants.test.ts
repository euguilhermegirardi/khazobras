import { describe, expect, it } from 'vitest';
import { arquivoTipo, podeVisualizar } from './constants';

describe('arquivoTipo', () => {
  it.each([
    ['planta.pdf', 'pdf'],
    ['PLANTA.PDF', 'pdf'],
    ['foto.jpg', 'imagem'],
    ['foto.JPEG', 'imagem'],
    ['foto.png', 'imagem'],
    ['foto.webp', 'imagem'],
    ['foto.gif', 'imagem'],
    ['orcamento.xls', 'planilha'],
    ['orcamento.XLSX', 'planilha'],
    ['desenho.dwg', 'outro'],
    ['memorial.docx', 'outro'],
    ['semextensao', 'outro'],
    ['arquivo.tar.pdf', 'pdf'],
    ['termina.com.ponto.', 'outro'],
  ])('%s -> %s', (nome, esperado) => {
    expect(arquivoTipo(nome)).toBe(esperado);
  });
});

describe('podeVisualizar', () => {
  it.each(['a.pdf', 'a.PDF', 'a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.gif', 'A.PNG'])('permite %s', (nome) => {
    expect(podeVisualizar(nome)).toBe(true);
  });

  it.each(['a.xlsx', 'a.xls', 'a.dwg', 'a.docx', 'a.txt', 'a.svg', 'a.html', 'a'])('não permite %s', (nome) => {
    expect(podeVisualizar(nome)).toBe(false);
  });
});
