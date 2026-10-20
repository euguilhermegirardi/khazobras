import { http, HttpResponse, type HttpHandler } from 'msw';
import { vi } from 'vitest';
import type { Etapa } from '@/interfaces/etapa';
import type { Foto, RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { API } from './server';

/** Apoio dos testes do Relatório fotográfico (admin). Dados sintéticos; formato igual ao do backend (DTO sem storage_key). */
export const OBRA_ID = '22222222-2222-2222-2222-222222222222';
export const OUTRA_OBRA_ID = '99999999-9999-9999-9999-999999999999';
export const ETAPA_ID = '33333333-3333-3333-3333-333333333333';
export const LISTA = `/admin/obras/${OBRA_ID}/relatorio-fotografico`;
export const detalheRota = (relatorioId: string) => `${LISTA}/${relatorioId}`;
export const TOKEN = 'token-falso-de-teste';

export const etapa = (over: Partial<Etapa> = {}): Etapa => ({
  id: ETAPA_ID,
  obraId: OBRA_ID,
  nome: 'Fundação',
  ordem: 1,
  ...over,
});

export const foto = (id: string, over: Partial<Foto> = {}): Foto => ({
  id,
  dataFoto: '2026-09-10',
  descricao: `Descrição ${id}`,
  ordem: 0,
  createdAt: '2026-09-11T12:00:00Z',
  ...over,
});

/** `n` fotos f1..fn com ordem 0..n-1 e `createdAt` crescente. */
export const fotosEmOrdem = (n: number, prefixo = 'f'): Foto[] =>
  Array.from({ length: n }, (_, i) =>
    foto(`${prefixo}${i + 1}`, {
      ordem: i,
      descricao: `Descrição ${i + 1}`,
      createdAt: `2026-09-11T12:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
    }),
  );

export const relatorio = (over: Partial<RelatorioFotografico> = {}): RelatorioFotografico => {
  const fotos = over.fotos ?? [];
  return {
    id: 'rf1',
    obraId: OBRA_ID,
    tipo: 'mensal',
    etapaId: null,
    titulo: 'Relatório de setembro',
    competencia: '2026-09-01',
    createdAt: '2026-10-01T12:00:00Z',
    quantidadeFotos: fotos.length,
    ...over,
    fotos,
  };
};

/** PNG de 8 bytes (assinatura): basta para o `blob` da miniatura. */
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Cabeçalhos/corpo que cada chamada de escrita recebeu, na ordem. */
export interface ChamadasFotos {
  listas: number;
  detalhes: number;
  etapas: number;
  arquivos: { id: string; auth: string }[];
  criar: { auth: string; body: Record<string, unknown> }[];
  editar: { id: string; body: Record<string, unknown> }[];
  excluir: string[];
  uploads: { relatorioId: string; auth: string; query: Record<string, string>; nome: string; campos: string[] }[];
  editarFoto: { id: string; body: Record<string, unknown> }[];
  removerFoto: string[];
  ordem: { relatorioId: string; body: { fotos: { id: string; ordem: number }[] } }[];
}

export interface Envio {
  nome: string;
  tipo: string;
  tamanho: number;
  campos: string[];
}

/**
 * No jsdom o `File` do app chega ao MSW com o nome "blob" (o `fetch` do Node não conhece o `File` do jsdom). A espiã
 * lê o `FormData` antes do envio; o servidor em memória usa o último arquivo visto. Chamar em `beforeEach`; a
 * restauração fica por conta do `vi.restoreAllMocks()` do `afterEach`.
 */
export function espiarEnvios(): { enviados: Envio[] } {
  const enviados: Envio[] = [];
  const fetchOriginal = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.body instanceof FormData) {
      const arquivo = init.body.get('file');
      if (arquivo instanceof File) {
        enviados.push({ nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, campos: [...init.body.keys()] });
      }
    }
    return fetchOriginal(input, init);
  });
  return { enviados };
}

/** Object URL não existe no jsdom (miniaturas e prévias). */
export function stubObjectUrl() {
  let contador = 0;
  const createObjectURL = vi.fn(() => `blob:http://localhost/foto-${(contador += 1)}`);
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
  return { createObjectURL, revokeObjectURL };
}

export interface ServidorFotos {
  handlers: HttpHandler[];
  chamadas: ChamadasFotos;
  /** Estado atual no "servidor". */
  relatorios: () => RelatorioFotografico[];
}

interface OpcoesServidor {
  etapas?: Etapa[];
  /** Lê o último arquivo visto pela espiã de `fetch` (ver `espiarEnvios`). */
  envios?: Envio[];
}

const comQuantidade = (r: RelatorioFotografico): RelatorioFotografico => ({ ...r, quantidadeFotos: r.fotos.length });
const porOrdem = (fotos: Foto[]) => [...fotos].sort((a, b) => a.ordem - b.ordem);

/**
 * API em memória do módulo: lista, detalhe, criar, editar, excluir, upload, editar/remover foto e lote de ordem.
 * Para forçar um erro, registre o handler da rota ANTES (`server.use(erro, ...api.handlers)`: o primeiro vence).
 */
export function servidorFotos(inicial: RelatorioFotografico[], opcoes: OpcoesServidor = {}): ServidorFotos {
  const estado = { relatorios: structuredClone(inicial), contador: 0 };
  const etapas = opcoes.etapas ?? [etapa()];
  const chamadas: ChamadasFotos = {
    listas: 0,
    detalhes: 0,
    etapas: 0,
    arquivos: [],
    criar: [],
    editar: [],
    excluir: [],
    uploads: [],
    editarFoto: [],
    removerFoto: [],
    ordem: [],
  };
  const achar = (id: string) => estado.relatorios.find((r) => r.id === id);
  const acharDaFoto = (fotoId: string) => estado.relatorios.find((r) => r.fotos.some((f) => f.id === fotoId));
  const auth = (request: Request) => request.headers.get('Authorization') ?? '';

  const handlers: HttpHandler[] = [
    http.get(`${API}/obras/:obraId/etapas`, () => {
      chamadas.etapas += 1;
      return HttpResponse.json(etapas);
    }),
    http.get(`${API}/obras/:obraId/relatorios-fotograficos`, ({ params }) => {
      chamadas.listas += 1;
      const daObra = estado.relatorios.filter((r) => r.obraId === params.obraId);
      // Mais novo primeiro, como o backend (created_at DESC, id).
      daObra.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      return HttpResponse.json(daObra.map(comQuantidade));
    }),
    http.get(`${API}/relatorios-fotograficos/:id`, ({ params }) => {
      chamadas.detalhes += 1;
      const r = achar(String(params.id));
      return r ? HttpResponse.json(comQuantidade(r)) : HttpResponse.json({}, { status: 404 });
    }),
    http.post(`${API}/relatorios-fotograficos`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.criar.push({ auth: auth(request), body });
      estado.contador += 1;
      const novo = relatorio({
        id: `novo-${estado.contador}`,
        obraId: String(body.obraId),
        tipo: body.tipo as RelatorioFotografico['tipo'],
        etapaId: (body.etapaId as string | null) ?? null,
        titulo: String(body.titulo),
        competencia: (body.competencia as string | null) ?? null,
        createdAt: '2026-10-20T12:00:00Z',
        fotos: [],
      });
      estado.relatorios.push(novo);
      return HttpResponse.json(novo, { status: 201 });
    }),
    http.put(`${API}/relatorios-fotograficos/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.editar.push({ id, body });
      const atual = achar(id);
      if (!atual) return HttpResponse.json({}, { status: 404 });
      Object.assign(atual, {
        tipo: body.tipo,
        etapaId: body.etapaId,
        titulo: body.titulo,
        competencia: body.competencia,
      });
      return HttpResponse.json(comQuantidade(atual));
    }),
    http.delete(`${API}/relatorios-fotograficos/:id`, ({ params }) => {
      const id = String(params.id);
      chamadas.excluir.push(id);
      if (!achar(id)) return HttpResponse.json({}, { status: 404 });
      estado.relatorios = estado.relatorios.filter((r) => r.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${API}/relatorios-fotograficos/:id/fotos`, ({ params, request }) => {
      const relatorioId = String(params.id);
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const visto = opcoes.envios?.at(-1);
      chamadas.uploads.push({
        relatorioId,
        auth: auth(request),
        query,
        nome: visto?.nome ?? '',
        campos: visto?.campos ?? [],
      });
      const atual = achar(relatorioId);
      if (!atual) return HttpResponse.json({}, { status: 404 });
      estado.contador += 1;
      const nova = foto(`up-${estado.contador}`, {
        ordem: atual.fotos.length,
        dataFoto: query.dataFoto ?? null,
        descricao: query.descricao ?? null,
        createdAt: '2026-10-20T12:00:00Z',
      });
      atual.fotos.push(nova);
      return HttpResponse.json(nova, { status: 201 });
    }),
    http.patch(`${API}/fotos/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.editarFoto.push({ id, body });
      const alvo = acharDaFoto(id)?.fotos.find((f) => f.id === id);
      if (!alvo) return HttpResponse.json({}, { status: 404 });
      if ('descricao' in body) alvo.descricao = body.descricao as string | null;
      if ('dataFoto' in body) alvo.dataFoto = body.dataFoto as string | null;
      return HttpResponse.json(alvo);
    }),
    http.delete(`${API}/fotos/:id`, ({ params }) => {
      const id = String(params.id);
      chamadas.removerFoto.push(id);
      const dono = acharDaFoto(id);
      if (!dono) return HttpResponse.json({}, { status: 404 });
      dono.fotos = dono.fotos.filter((f) => f.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${API}/relatorios-fotograficos/:id/fotos/ordem`, async ({ params, request }) => {
      const relatorioId = String(params.id);
      const body = (await request.json()) as { fotos: { id: string; ordem: number }[] };
      chamadas.ordem.push({ relatorioId, body });
      const atual = achar(relatorioId);
      if (!atual) return HttpResponse.json({}, { status: 404 });
      for (const item of body.fotos) {
        const alvo = atual.fotos.find((f) => f.id === item.id);
        if (alvo) alvo.ordem = item.ordem;
      }
      return HttpResponse.json(porOrdem(atual.fotos));
    }),
    http.get(`${API}/fotos/:id/arquivo`, ({ params, request }) => {
      chamadas.arquivos.push({ id: String(params.id), auth: auth(request) });
      return new HttpResponse(PNG, { headers: { 'Content-Type': 'image/png' } });
    }),
  ];

  return { handlers, chamadas, relatorios: () => estado.relatorios };
}

/** Handler que responde `status` com `body` em qualquer método/rota dada (para forçar 400/403/404/500). */
export const erroEm = (
  metodo: 'get' | 'post' | 'put' | 'patch' | 'delete',
  caminho: string,
  status: number,
  body: unknown = {},
): HttpHandler => http[metodo](`${API}${caminho}`, () => HttpResponse.json(body as never, { status }));
