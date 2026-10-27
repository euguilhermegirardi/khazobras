import { waitFor } from '@testing-library/react';

/**
 * Espera o `<h2>` com o texto exato aparecer, por seletor.
 *
 * Em tela com ~100 a 200 itens, `findByRole`/`findByText` refazem a consulta no DOM inteiro a cada mutação (cada
 * miniatura ou linha que muda de estado dispara uma); sob CPU saturada isso custa segundos. O seletor é O(nós)
 * barato. Use só para "a tela montou"; as asserções do teste continuam por papel/texto.
 */
export async function esperarTitulo2(texto: string) {
  await waitFor(() => {
    const achou = Array.from(document.querySelectorAll('h2')).some((h) => h.textContent === texto);
    if (!achou) throw new Error(`Título "${texto}" ainda não apareceu.`);
  });
}
