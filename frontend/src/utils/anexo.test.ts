import { describe, expect, it } from 'vitest';
import { ANEXO_MAX_BYTES, prepararAnexo, validarAnexo } from './anexo';

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
