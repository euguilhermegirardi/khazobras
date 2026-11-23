import { describe, expect, it } from 'vitest';
import {
  extensaoDe,
  PROJETO_EXTENSOES_TEXTO,
  PROJETO_MAX_BYTES,
  PROJETO_NOME_MAX,
  partirNome,
  temBarraOuControle,
  temControle,
  validarProjetoArquivo,
} from './projetoRegras';

const arq = (name: string, size = 100) => ({ name, size });

describe('validarProjetoArquivo', () => {
  it.each(['a.pdf', 'A.PDF', 'a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.gif', 'a.doc', 'a.docx', 'a.xls', 'a.xlsx'])(
    'aceita %s',
    (nome) => expect(validarProjetoArquivo(arq(nome))).toBeNull(),
  );

  it.each(['a.txt', 'a.dwg', 'a.zip', 'a', 'a.pdf.exe', '.pdfx'])('recusa %s pelo tipo', (nome) => {
    expect(validarProjetoArquivo(arq(nome))).toBe(`Tipo de arquivo não permitido. Use: ${PROJETO_EXTENSOES_TEXTO}.`);
  });

  it('recusa vazio, acima de 10 MB (10 MB exato passa) e nome em branco', () => {
    expect(validarProjetoArquivo(arq('a.pdf', 0))).toMatch(/vazio/);
    expect(validarProjetoArquivo(arq('a.pdf', PROJETO_MAX_BYTES + 1))).toMatch(/10 MB/);
    expect(validarProjetoArquivo(arq('a.pdf', PROJETO_MAX_BYTES))).toBeNull();
    expect(validarProjetoArquivo(arq('   '))).toMatch(/não tem nome/);
  });

  it('nome com 255 caracteres passa; com 256 não', () => {
    expect(validarProjetoArquivo(arq(`${'a'.repeat(PROJETO_NOME_MAX - 4)}.pdf`))).toBeNull();
    expect(validarProjetoArquivo(arq(`${'a'.repeat(PROJETO_NOME_MAX - 3)}.pdf`))).toMatch(/no máximo 255/);
  });

  it('recusa barras e caracteres de controle no nome', () => {
    expect(validarProjetoArquivo(arq('a\\b.pdf'))).toMatch(/barras/);
    expect(validarProjetoArquivo(arq('a/b.pdf'))).toMatch(/barras/);
    expect(validarProjetoArquivo(arq('a\u0007b.pdf'))).toMatch(/controle/);
  });
});

describe('extensaoDe / temBarraOuControle / temControle', () => {
  it('extensão em minúscula com ponto; vazia sem ponto', () => {
    expect(extensaoDe('Planta.PDF')).toBe('.pdf');
    expect(extensaoDe('a.b.c.docx')).toBe('.docx');
    expect(extensaoDe('semponto')).toBe('');
  });

  it('barra e controle', () => {
    expect(temBarraOuControle('ok.pdf')).toBe(false);
    expect(temBarraOuControle('a/b')).toBe(true);
    expect(temBarraOuControle('a\\b')).toBe(true);
    expect(temBarraOuControle('a\nb')).toBe(true);
    expect(temBarraOuControle('a\u007fb')).toBe(true);
    expect(temControle('a/b')).toBe(false);
    expect(temControle('a\tb')).toBe(true);
  });
});

describe('partirNome', () => {
  it('separa base e extensão preservando a caixa original da extensão', () => {
    expect(partirNome('planta.pdf')).toEqual({ base: 'planta', extensao: '.pdf' });
    expect(partirNome('Planta.PDF')).toEqual({ base: 'Planta', extensao: '.PDF' });
  });

  it('usa só o último ponto', () => {
    expect(partirNome('a.b.pdf')).toEqual({ base: 'a.b', extensao: '.pdf' });
    expect(partirNome('x.pdf.pdf')).toEqual({ base: 'x.pdf', extensao: '.pdf' });
  });

  it('sem ponto, a extensão é vazia', () => {
    expect(partirNome('planta')).toEqual({ base: 'planta', extensao: '' });
    expect(partirNome('')).toEqual({ base: '', extensao: '' });
  });
});
