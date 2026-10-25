import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

// jsdom não tem ResizeObserver e o ResponsiveContainer do Recharts (Dashboard) o exige. Stub mínimo, sem medir nada:
// o gráfico renderiza com `initialDimension`. Teste que dependa de layout real é e2e.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub;
}

// Default de 1000 ms do findBy/waitFor estoura em máquina lenta ou sob carga (MSW + refetch + jsdom). Só o teto de
// espera: teste que passa continua rápido; teste que falha de verdade só demora mais para falhar.
configure({ asyncUtilTimeout: 5000 });

// Requisições em voo (MSW). O teste pode terminar antes da resposta (ex.: refetch depois de uma mutação); sem esperar,
// a resposta atrasada cai no teste seguinte (handlers já trocados) e vira "Não foi possível conectar ao servidor".
const emVoo = new Set<string>();
const LIMITE_DRENAGEM_MS = 500;

async function esperarRequisicoesEmVoo() {
  const limite = Date.now() + LIMITE_DRENAGEM_MS;
  while (emVoo.size > 0 && Date.now() < limite) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  // Teste com requisição que nunca responde (estado "carregando") não pode vazar para o seguinte.
  emVoo.clear();
}

beforeAll(() => {
  server.events.on('request:start', ({ requestId }) => emVoo.add(requestId));
  server.events.on('request:end', ({ requestId }) => emVoo.delete(requestId));
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(async () => {
  cleanup();
  await esperarRequisicoesEmVoo();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());
