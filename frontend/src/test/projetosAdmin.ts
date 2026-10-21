import { http, HttpResponse, type HttpHandler } from 'msw';
import type { Etapa } from '@/interfaces/etapa';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { API } from './server';

/** Apoio dos testes de Projetos (admin). Dados sintéticos; formato igual ao do backend (DTO sem storage_key). */
export const OBRA_ID = '22222222-2222-2222-2222-222222222222';
export const OUTRA_OBRA_ID = '99999999-9999-9999-9999-999999999999';
export const ROTA = `/admin/obras/${OBRA_ID}/projetos`;
export const ROTA_CLIENTE = `/cliente/obras/${OBRA_ID}/projetos`;
export const TOKEN = 'token-falso-de-teste';
export const ETAPA_FUNDACAO = '33333333-3333-3333-3333-333333333333';
export const ETAPA_ALVENARIA = '44444444-4444-4444-4444-444444444444';

export const etapa = (id: string, nome: string, ordem: number): Etapa => ({ id, obraId: OBRA_ID, nome, ordem });
export const ETAPAS: Etapa[] = [etapa(ETAPA_FUNDACAO, 'Fundação', 1), etapa(ETAPA_ALVENARIA, 'Alvenaria', 2)];

export const projeto = (id: string, over: Partial<ProjetoDocumento> = {}): ProjetoDocumento => ({
  id,
  obraId: OBRA_ID,
  etapaId: null,
  nome: `${id}.pdf`,
  tipoDocumento: null,
  uploadedAt: '2026-03-10T15:00:00Z',
  ...over,
});

/** `n` documentos sem etapa (d1.pdf..dn.pdf). */
export const documentos = (n: number): ProjetoDocumento[] =>
  Array.from({ length: n }, (_, i) => projeto(`d${i + 1}`, { nome: `doc-${i + 1}.pdf` }));

export interface EnvioProjeto {
  nome: string;
  tipo: string;
  campos: string[];
}

export interface UploadVisto {
  auth: string;
  /** Query crua, como foi na rede (para conferir o `encodeURIComponent`). */
  search: string;
  query: Record<string, string>;
  nome: string;
  campos: string[];
}

export interface ChamadasProjetos {
  listas: number;
  etapas: number;
  uploads: UploadVisto[];
  editar: { id: string; auth: string; body: Record<string, unknown> }[];
  excluir: { id: string; auth: string }[];
  downloads: { id: string; auth: string }[];
}

export interface ServidorProjetos {
  handlers: HttpHandler[];
  chamadas: ChamadasProjetos;
  /** Estado atual no "servidor". */
  projetos: () => ProjetoDocumento[];
}

interface OpcoesServidor {
  etapas?: Etapa[];
  /** Arquivos vistos pela espiã de `fetch` (ver `espiarEnvios` de `fotosAdmin`): o último é o do POST em curso. */
  envios?: EnvioProjeto[];
  /** Limite de documentos por obra (o backend recusa o 201º com 400 `{ message }`). */
  limite?: number;
}

/** Como o backend: por ordem da etapa, sem etapa por último, depois o mais novo primeiro. */
function ordenar(projetos: ProjetoDocumento[], etapas: Etapa[]): ProjetoDocumento[] {
  const ordemDe = (p: ProjetoDocumento) =>
    p.etapaId === null ? Number.MAX_SAFE_INTEGER : (etapas.find((e) => e.id === p.etapaId)?.ordem ?? 1_000_000);
  return [...projetos].sort((a, b) => ordemDe(a) - ordemDe(b) || b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * API em memória do módulo: lista, etapas, upload, PUT, DELETE e download. Para forçar um erro, registre o handler
 * ANTES (`server.use(erro, ...api.handlers)`: o primeiro vence).
 */
export function servidorProjetos(inicial: ProjetoDocumento[], opcoes: OpcoesServidor = {}): ServidorProjetos {
  const estado = { projetos: structuredClone(inicial), contador: 0 };
  const etapas = opcoes.etapas ?? ETAPAS;
  const limite = opcoes.limite ?? 200;
  const chamadas: ChamadasProjetos = { listas: 0, etapas: 0, uploads: [], editar: [], excluir: [], downloads: [] };
  const auth = (request: Request) => request.headers.get('Authorization') ?? '';

  const handlers: HttpHandler[] = [
    http.get(`${API}/obras/:obraId/etapas`, () => {
      chamadas.etapas += 1;
      return HttpResponse.json(etapas);
    }),
    http.get(`${API}/obras/:obraId/projetos`, ({ params }) => {
      chamadas.listas += 1;
      return HttpResponse.json(
        ordenar(
          estado.projetos.filter((p) => p.obraId === params.obraId),
          etapas,
        ),
      );
    }),
    http.post(`${API}/obras/:obraId/projetos`, ({ params, request }) => {
      const url = new URL(request.url);
      const query = Object.fromEntries(url.searchParams.entries());
      const visto = opcoes.envios?.at(-1);
      chamadas.uploads.push({
        auth: auth(request),
        search: url.search,
        query,
        nome: visto?.nome ?? '',
        campos: visto?.campos ?? [],
      });
      const daObra = estado.projetos.filter((p) => p.obraId === params.obraId);
      if (daObra.length >= limite) {
        return HttpResponse.json({ message: `A obra já tem o máximo de ${limite} documentos.` }, { status: 400 });
      }
      estado.contador += 1;
      const novo = projeto(`up-${estado.contador}`, {
        obraId: String(params.obraId),
        nome: visto?.nome ?? `up-${estado.contador}.pdf`,
        etapaId: query.etapaId ?? null,
        tipoDocumento: query.tipoDocumento ?? null,
        uploadedAt: '2026-10-20T12:00:00Z',
      });
      estado.projetos.push(novo);
      return HttpResponse.json(novo, { status: 201 });
    }),
    http.put(`${API}/projetos/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.editar.push({ id, auth: auth(request), body });
      const atual = estado.projetos.find((p) => p.id === id);
      if (!atual) return HttpResponse.json({}, { status: 404 });
      Object.assign(atual, { nome: body.nome, tipoDocumento: body.tipoDocumento, etapaId: body.etapaId });
      return HttpResponse.json(atual);
    }),
    http.delete(`${API}/projetos/:id`, ({ params, request }) => {
      const id = String(params.id);
      chamadas.excluir.push({ id, auth: auth(request) });
      if (!estado.projetos.some((p) => p.id === id)) return HttpResponse.json({}, { status: 404 });
      estado.projetos = estado.projetos.filter((p) => p.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${API}/projetos/:id/download`, ({ params, request }) => {
      chamadas.downloads.push({ id: String(params.id), auth: auth(request) });
      return new HttpResponse(Uint8Array.from([37, 80, 68, 70]), { headers: { 'Content-Type': 'application/pdf' } });
    }),
  ];

  return { handlers, chamadas, projetos: () => estado.projetos };
}
