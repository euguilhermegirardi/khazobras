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

describe('lancamentoCategoria - bordas', () => {
  it('rótulos cobrem PascalCase e snake_case e batem com as opções do backend', () => {
    expect(Object.keys(CATEGORIA_LABEL).sort()).toEqual(
      ['Equipamento', 'MaoDeObra', 'Material', 'equipamento', 'mao_de_obra', 'material'].sort(),
    );
    const rotulosDoBackend = { mao_de_obra: 'Mão de obra', material: 'Material', equipamento: 'Equipamento' };
    for (const [valor, rotulo] of Object.entries(rotulosDoBackend)) {
      expect(CATEGORIA_LABEL[valor as keyof typeof CATEGORIA_LABEL]).toBe(rotulo);
    }
    expect(CATEGORIA_LABEL.MaoDeObra).toBe(CATEGORIA_LABEL.mao_de_obra);
  });

  it('ida e volta: PascalCase -> request e request -> request são estáveis', () => {
    for (const [resposta, request] of [
      ['MaoDeObra', 'mao_de_obra'],
      ['Material', 'material'],
      ['Equipamento', 'equipamento'],
    ] as const) {
      expect(categoriaParaRequest(resposta)).toBe(request);
      expect(categoriaParaRequest(request)).toBe(request);
    }
  });

  it('valor desconhecido (backend novo) cai em material em vez de quebrar', () => {
    expect(categoriaParaRequest('Outra' as never)).toBe('material');
    expect(categoriaParaRequest('' as never)).toBe('material');
  });
});

describe('formatBytes', () => {
  it('bordas: 0, 1023, 1024, 1 MB e 10 MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
  });

  it('formata em B, KB e MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(10240)).toBe('10 KB');
    expect(formatBytes(1572864)).toBe('1,5 MB');
  });
});
