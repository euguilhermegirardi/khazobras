import { describe, expect, it } from 'vitest';
import { FOTO_MAX_BYTES, validarFoto } from './foto';

describe('validarFoto', () => {
  it('aceita as cinco extensões de imagem, em qualquer caixa', () => {
    for (const nome of ['a.jpg', 'a.JPEG', 'a.png', 'a.WebP', 'a.gif']) {
      expect(validarFoto({ name: nome, size: 1024 })).toBeNull();
    }
  });

  it('aceita exatamente 10 MB e recusa 1 byte a mais', () => {
    expect(validarFoto({ name: 'a.jpg', size: FOTO_MAX_BYTES })).toBeNull();
    expect(validarFoto({ name: 'a.jpg', size: FOTO_MAX_BYTES + 1 })).toMatch(/10 MB/);
  });

  it('recusa arquivo vazio, sem nome, nome longo e extensão que não é imagem', () => {
    expect(validarFoto({ name: 'a.jpg', size: 0 })).toMatch(/vazio/);
    expect(validarFoto({ name: '  ', size: 10 })).toMatch(/nome/);
    expect(validarFoto({ name: `${'a'.repeat(252)}.jpg`, size: 10 })).toMatch(/255/);
    expect(validarFoto({ name: `${'a'.repeat(251)}.jpg`, size: 10 })).toBeNull();
    expect(validarFoto({ name: 'planta.pdf', size: 10 })).toMatch(/imagens/);
    expect(validarFoto({ name: 'semextensao', size: 10 })).toMatch(/imagens/);
    expect(validarFoto({ name: 'foto.svg', size: 10 })).toMatch(/imagens/);
  });
});
