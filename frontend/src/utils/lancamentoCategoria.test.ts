import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';
import { CATEGORIA_LABEL, categoriaParaRequest } from './lancamentoCategoria';

describe('categoriaParaRequest', () => {
  it('converte a resposta (PascalCase) para o request (snake_case) e aceita snake_case', () => {
    expect(categoriaParaRequest('MaoDeObra')).toBe('mao_de_obra');
    expect(categoriaParaRequest('Material')).toBe('material');
    expect(categoriaParaRequest('Equipamento')).toBe('equipamento');
    expect(categoriaParaRequest('mao_de_obra')).toBe('mao_de_obra');
  });

  it('tem rótulo em português para as três categorias', () => {
    expect(CATEGORIA_LABEL.MaoDeObra).toBe('Mão de obra');
    expect(CATEGORIA_LABEL.Equipamento).toBe('Equipamento');
  });
});

describe('formatBytes', () => {
  it('formata em B, KB e MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(10240)).toBe('10 KB');
    expect(formatBytes(1572864)).toBe('1,5 MB');
  });
});
