/**
 * Cores do gráfico "Custo acumulado": só tokens do tema (claro/escuro). A mesma constante alimenta o gráfico e a
 * legenda (checklist 8d: legenda = elemento). Escolhidas por contraste entre si (azul × âmbar, legível por quem não
 * distingue vermelho/verde) e por não serem cores de status do Cronograma/Badges (sem verde nem vermelho).
 */
export const COR_BARRA = 'var(--chart-1)';
export const COR_LINHA = 'var(--chart-3)';

export const NOME_BARRA = 'Medido no mês';
export const NOME_LINHA = 'Acumulado';

/** Altura fixa do gráfico em px (o card não "pula" ao carregar). */
export const ALTURA_GRAFICO = 280;
/** Largura usada só antes da primeira medição do contêiner (e em ambientes sem layout, como o jsdom). */
export const LARGURA_INICIAL_GRAFICO = 560;

export const MENSAGEM_SEM_MEDICOES = 'Ainda não há medições aprovadas';
