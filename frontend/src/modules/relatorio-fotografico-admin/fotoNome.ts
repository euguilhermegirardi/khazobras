import type { Foto } from '@/interfaces/relatorioFotografico';

const MAX_DESCRICAO_NO_NOME = 40;

/** Nome falado da foto nos rótulos dos botões: "foto 3" ou "foto 3 (Fundação concluída)" (descrição cortada em 40). */
export function nomeDaFoto(foto: Pick<Foto, 'descricao'>, posicao: number): string {
  const descricao = foto.descricao?.trim();
  if (!descricao) return `foto ${posicao}`;
  const curta = descricao.length > MAX_DESCRICAO_NO_NOME ? `${descricao.slice(0, MAX_DESCRICAO_NO_NOME)}…` : descricao;
  return `foto ${posicao} (${curta})`;
}

/** Id do botão de mover (a grade devolve o foco a ele depois de reordenar). */
export function idBotaoMover(fotoId: string, direcao: -1 | 1): string {
  return `foto-${fotoId}-${direcao === -1 ? 'esq' : 'dir'}`;
}
