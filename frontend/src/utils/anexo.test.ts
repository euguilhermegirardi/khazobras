import { describe, expect, it } from 'vitest';
import {
  ANEXO_ACCEPT,
  ANEXO_EXTENSOES_TEXTO,
  ANEXO_MAX_BYTES,
  ANEXO_MAX_POR_LANCAMENTO,
  prepararAnexo,
  validarAnexo,
} from './anexo';

describe('limites e listas do anexo', () => {
  it('10 MB por arquivo e 10 por lançamento (iguais ao backend)', () => {
    expect(ANEXO_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(ANEXO_MAX_POR_LANCAMENTO).toBe(10);
  });

  it('accept e texto das extensões listam exatamente as 11 permitidas', () => {
    const extensoes = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    expect(ANEXO_ACCEPT.split(',')).toEqual(extensoes);
    expect(ANEXO_EXTENSOES_TEXTO).toBe('JPG, JPEG, PNG, WEBP, GIF, PDF, DOC, DOCX, XLS, XLSX, TXT');
  });
});

describe('validarAnexo - bordas', () => {
  it('tamanho negativo conta como vazio e 1 byte passa', () => {
    expect(validarAnexo({ name: 'a.pdf', size: -1 })).toMatch(/vazio/i);
    expect(validarAnexo({ name: 'a.pdf', size: 1 })).toBeNull();
  });

  it('a ordem das checagens: vazio, depois tamanho, depois nome, depois extensão', () => {
    expect(validarAnexo({ name: 'x.exe', size: 0 })).toMatch(/vazio/i);
    expect(validarAnexo({ name: 'x.exe', size: ANEXO_MAX_BYTES + 1 })).toMatch(/10 MB/);
    expect(validarAnexo({ name: '', size: 5 })).toMatch(/nome/i);
  });

  it('extensão em qualquer mistura de maiúsculas e minúsculas', () => {
    for (const name of ['A.PdF', 'FOTO.JPG', 'planilha.XlSx', 'nota.TXT']) {
      expect(validarAnexo({ name, size: 5 })).toBeNull();
    }
  });

  it('nome com espaços, acentos e pontos no meio é aceito pela extensão final', () => {
    expect(validarAnexo({ name: 'Nota fiscal - cimento (set.2026).pdf', size: 5 })).toBeNull();
    expect(validarAnexo({ name: 'orçamento_açaí.docx', size: 5 })).toBeNull();
  });

  it('extensão fora da lista, ponto final e extensões parecidas são recusadas', () => {
    for (const name of ['a.', 'a.pdfx', 'a.jpgg', 'a.zip', 'a.svg', 'a.html', 'a.exe', 'pdf', 'a.pdf ']) {
      expect(validarAnexo({ name, size: 5 })).toMatch(/não permitido/i);
    }
  });
});

describe('prepararAnexo - bordas', () => {
  it.each([
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
    ['a.gif', 'image/gif'],
    ['a.pdf', 'application/pdf'],
    ['a.doc', 'application/msword'],
    ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['a.xls', 'application/vnd.ms-excel'],
    ['a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['a.txt', 'text/plain'],
  ])('%s sai com o MIME %s mesmo que o navegador mande outro', (nome, mime) => {
    expect(prepararAnexo(new File(['x'], nome, { type: 'application/octet-stream' })).type).toBe(mime);
  });

  it('preserva nome, conteúdo e data de modificação ao regravar o MIME', async () => {
    const original = new File(['conteudo sintetico'], 'Foto Obra.JPEG', {
      type: 'image/jpg',
      lastModified: 1_700_000_000_000,
    });
    const pronto = prepararAnexo(original);
    expect(pronto).not.toBe(original);
    expect(pronto.type).toBe('image/jpeg');
    expect(pronto.name).toBe('Foto Obra.JPEG');
    expect(pronto.lastModified).toBe(1_700_000_000_000);
    expect(pronto.size).toBe(original.size);
    expect(await pronto.text()).toBe('conteudo sintetico');
  });

  it('extensão desconhecida devolve o mesmo arquivo (a validação é quem recusa)', () => {
    const arquivo = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    expect(prepararAnexo(arquivo)).toBe(arquivo);
  });
});

describe('validarAnexo', () => {
  it('aceita as extensões permitidas (qualquer caixa) até 10 MB', () => {
    for (const name of [
      'a.jpg',
      'a.JPEG',
      'a.png',
      'a.webp',
      'a.gif',
      'a.pdf',
      'a.doc',
      'a.docx',
      'a.xls',
      'a.xlsx',
      'a.txt',
    ]) {
      expect(validarAnexo({ name, size: 100 })).toBeNull();
    }
    expect(validarAnexo({ name: 'a.pdf', size: ANEXO_MAX_BYTES })).toBeNull();
  });

  it('recusa vazio, acima de 10 MB, sem nome e extensão fora da lista', () => {
    expect(validarAnexo({ name: 'a.pdf', size: 0 })).toMatch(/vazio/i);
    expect(validarAnexo({ name: 'a.pdf', size: ANEXO_MAX_BYTES + 1 })).toMatch(/10 MB/);
    expect(validarAnexo({ name: '  ', size: 10 })).toMatch(/nome/i);
    expect(validarAnexo({ name: 'virus.exe', size: 10 })).toMatch(/não permitido/i);
    expect(validarAnexo({ name: 'semextensao', size: 10 })).toMatch(/não permitido/i);
    expect(validarAnexo({ name: 'a.pdf.exe', size: 10 })).toMatch(/não permitido/i);
  });
});

describe('prepararAnexo', () => {
  it('ajusta o MIME para o da extensão (o backend recusa incompatíveis)', () => {
    const arquivo = new File(['x'], 'nota.PDF', { type: '' });
    const pronto = prepararAnexo(arquivo);
    expect(pronto.type).toBe('application/pdf');
    expect(pronto.name).toBe('nota.PDF');
  });

  it('mantém o mesmo arquivo quando o MIME já é o certo', () => {
    const arquivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    expect(prepararAnexo(arquivo)).toBe(arquivo);
  });
});
