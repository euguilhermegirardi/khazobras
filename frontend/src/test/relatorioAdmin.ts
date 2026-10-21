import { http, HttpResponse, type HttpHandler } from 'msw';
import type { RelatorioMensalAdmin, RelatorioMensalHistorico } from '@/interfaces/relatorioMensal';
import { API } from './server';

/**
 * Apoio dos testes do Relatório ao cliente (admin). Dados sintéticos; formato igual ao do backend
 * (RelatorioMensalResponse com `createdByUserId`, histórico sem texto, 409 `{ message }` sem acentos).
 */
export const OBRA_ID = '22222222-2222-2222-2222-222222222222';
export const OUTRA_OBRA_ID = '99999999-9999-9999-9999-999999999999';
export const ROTA_LISTA = `/admin/obras/${OBRA_ID}/relatorio-ao-cliente`;
export const ROTA_NOVO = `${ROTA_LISTA}/novo`;
export const ROTA_CLIENTE = `/cliente/obras/${OBRA_ID}/relatorio-mensal`;
export const TOKEN = 'token-falso-de-teste';
export const AUTOR_ID = '33333333-3333-3333-3333-333333333333';

export const rotaDetalhe = (id: string) => `${ROTA_LISTA}/${id}`;

/** O que o backend manda ao admin: o tipo da tela + `createdByUserId` (que a tela nunca mostra). */
export type RelatorioServidor = RelatorioMensalAdmin & { createdByUserId: string };

export const relatorio = (id: string, over: Partial<RelatorioServidor> = {}): RelatorioServidor => ({
  id,
  obraId: OBRA_ID,
  competencia: '2026-10-01',
  conteudo: `Texto do relatório ${id}.`,
  status: 'draft',
  publishedAt: null,
  createdByUserId: AUTOR_ID,
  createdAt: '2026-10-18T12:00:00Z',
  updatedAt: '2026-10-20T14:30:00Z',
  ...over,
});

export const publicado = (id: string, over: Partial<RelatorioServidor> = {}): RelatorioServidor =>
  relatorio(id, { status: 'published', publishedAt: '2026-10-02T12:00:00Z', ...over });

export const registro = (acao: string, over: Partial<RelatorioMensalHistorico> = {}): RelatorioMensalHistorico => ({
  acao,
  userId: AUTOR_ID,
  userName: 'Ana Admin',
  createdAt: '2026-10-18T12:00:00Z',
  campos: [],
  ...over,
});

export interface ChamadasRelatorios {
  /** Valor de `onlyPublished` de cada GET da lista, na ordem (o admin manda `false`, o cliente `true`). */
  listas: (string | null)[];
  detalhes: string[];
  historicos: string[];
  criar: { auth: string; body: Record<string, unknown> }[];
  editar: { id: string; auth: string; body: Record<string, unknown> }[];
  excluir: { id: string; auth: string }[];
  publicar: { id: string; auth: string }[];
  /** Linha do tempo de tudo que foi chamado (`GET detalhe r1`, `DELETE r1`...), para conferir a ordem. */
  ordem: string[];
}

export interface ServidorRelatorios {
  handlers: HttpHandler[];
  chamadas: ChamadasRelatorios;
  /** Estado atual no "servidor". */
  relatorios: () => RelatorioServidor[];
}

interface OpcoesServidor {
  historicos?: Record<string, RelatorioMensalHistorico[]>;
}

const AGORA = '2026-10-21T10:00:00Z';

/**
 * API em memória do módulo (lista admin e cliente, GET, POST, PUT, DELETE, publish e histórico), com as mesmas
 * regras do backend: mês repetido = 409, publicado não edita nem exclui = 409, publicar de novo = 409. Para forçar um
 * erro, registre o handler ANTES (`server.use(erro, ...api.handlers)`: o primeiro vence).
 */
export function servidorRelatorios(inicial: RelatorioServidor[], opcoes: OpcoesServidor = {}): ServidorRelatorios {
  const estado = { relatorios: structuredClone(inicial), contador: 0 };
  const chamadas: ChamadasRelatorios = {
    listas: [],
    detalhes: [],
    historicos: [],
    criar: [],
    editar: [],
    excluir: [],
    publicar: [],
    ordem: [],
  };
  const auth = (request: Request) => request.headers.get('Authorization') ?? '';
  const achar = (id: string) => estado.relatorios.find((r) => r.id === id);
  const naoEncontrado = () => HttpResponse.json({}, { status: 404 });
  const conflito = (message: string) => HttpResponse.json({ message }, { status: 409 });
  const mesRepetido = (obraId: string, competencia: string, ignorar?: string) =>
    estado.relatorios.some((r) => r.obraId === obraId && r.competencia === competencia && r.id !== ignorar);
  const MES_USADO = 'Ja existe um relatorio desta obra para a competencia informada.';

  const handlers: HttpHandler[] = [
    http.get(`${API}/obras/:obraId/relatorios-mensais`, ({ params, request }) => {
      const somentePublicados = new URL(request.url).searchParams.get('onlyPublished');
      chamadas.listas.push(somentePublicados);
      chamadas.ordem.push(`GET lista onlyPublished=${somentePublicados}`);
      return HttpResponse.json(
        estado.relatorios.filter(
          (r) => r.obraId === params.obraId && (somentePublicados !== 'true' || r.status === 'published'),
        ),
      );
    }),
    http.post(`${API}/relatorios-mensais`, async ({ request }) => {
      const body = (await request.json()) as { obraId: string; competencia: string; conteudo: string };
      chamadas.criar.push({ auth: auth(request), body });
      chamadas.ordem.push('POST criar');
      if (mesRepetido(body.obraId, body.competencia)) return conflito(MES_USADO);
      estado.contador += 1;
      const novo = relatorio(`novo-${estado.contador}`, {
        obraId: body.obraId,
        competencia: body.competencia,
        conteudo: body.conteudo,
        createdAt: AGORA,
        updatedAt: AGORA,
      });
      estado.relatorios.push(novo);
      return HttpResponse.json(novo, { status: 201 });
    }),
    http.get(`${API}/relatorios-mensais/:id`, ({ params }) => {
      const id = String(params.id);
      chamadas.detalhes.push(id);
      chamadas.ordem.push(`GET detalhe ${id}`);
      const atual = achar(id);
      return atual ? HttpResponse.json(atual) : naoEncontrado();
    }),
    http.put(`${API}/relatorios-mensais/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as { competencia: string; conteudo: string };
      chamadas.editar.push({ id, auth: auth(request), body });
      chamadas.ordem.push(`PUT ${id}`);
      const atual = achar(id);
      if (!atual) return naoEncontrado();
      if (atual.status === 'published') return conflito('Relatorio publicado nao pode ser editado.');
      if (mesRepetido(atual.obraId, body.competencia, id)) return conflito(MES_USADO);
      Object.assign(atual, { competencia: body.competencia, conteudo: body.conteudo, updatedAt: AGORA });
      return HttpResponse.json(atual);
    }),
    http.delete(`${API}/relatorios-mensais/:id`, ({ params, request }) => {
      const id = String(params.id);
      chamadas.excluir.push({ id, auth: auth(request) });
      chamadas.ordem.push(`DELETE ${id}`);
      const atual = achar(id);
      if (!atual) return naoEncontrado();
      if (atual.status === 'published') return conflito('Relatorio publicado nao pode ser excluido.');
      estado.relatorios = estado.relatorios.filter((r) => r.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${API}/relatorios-mensais/:id/publish`, ({ params, request }) => {
      const id = String(params.id);
      chamadas.publicar.push({ id, auth: auth(request) });
      chamadas.ordem.push(`POST publish ${id}`);
      const atual = achar(id);
      if (!atual) return naoEncontrado();
      if (atual.status === 'published') return conflito('Relatorio ja esta publicado.');
      Object.assign(atual, { status: 'published', publishedAt: AGORA, updatedAt: AGORA });
      return HttpResponse.json(atual);
    }),
    http.get(`${API}/relatorios-mensais/:id/historico`, ({ params }) => {
      const id = String(params.id);
      chamadas.historicos.push(id);
      chamadas.ordem.push(`GET historico ${id}`);
      if (!achar(id)) return naoEncontrado();
      return HttpResponse.json(opcoes.historicos?.[id] ?? []);
    }),
  ];

  return { handlers, chamadas, relatorios: () => estado.relatorios };
}
