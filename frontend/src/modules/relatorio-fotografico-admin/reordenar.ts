import type { Foto, FotoOrdemItem } from '@/interfaces/relatorioFotografico';
import { ordenarFotos } from '@/utils/relatorioFotografico';

/**
 * Troca a foto `id` de lugar com a vizinha (`-1` = para antes, `+1` = para depois) e renumera TODAS as fotos de 0 a
 * n-1 (assim `ordem` repetida, que o backend aceita, deixa de existir). `null` = não dá para mover (id desconhecido
 * ou já na ponta). Não altera o array recebido.
 */
export function moverFoto(fotos: Foto[], id: string, direcao: -1 | 1): Foto[] | null {
  const ordenadas = ordenarFotos(fotos);
  const de = ordenadas.findIndex((f) => f.id === id);
  const para = de + direcao;
  const origem = ordenadas[de];
  const destino = ordenadas[para];
  if (de < 0 || !origem || !destino) return null;
  ordenadas[de] = destino;
  ordenadas[para] = origem;
  return ordenadas.map((foto, indice) => ({ ...foto, ordem: indice }));
}

/**
 * Corpo do lote de ordem: só as fotos cuja `ordem` mudou entre `antes` e `depois` (o backend deixa as outras como
 * estão). Lista vazia = nada a gravar.
 */
export function ordemAlterada(antes: Foto[], depois: Foto[]): FotoOrdemItem[] {
  const ordemAntes = new Map(antes.map((f) => [f.id, f.ordem]));
  return depois.filter((f) => ordemAntes.get(f.id) !== f.ordem).map((f) => ({ id: f.id, ordem: f.ordem }));
}
