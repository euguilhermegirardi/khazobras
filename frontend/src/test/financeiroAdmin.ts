import { http, HttpResponse } from 'msw';
import type { LancamentoAnexo } from '@/interfaces/financeiro';
import type { FinanceiroResumo, LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { API } from './server';

/** Dados e API simulada da tela Financeiro (admin). Formato real do backend; dados sintéticos. */
export const OBRA_ID = '33333333-3333-3333-3333-333333333333';
export const ADMIN = `/admin/obras/${OBRA_ID}/financeiro`;
export const CLIENTE = `/cliente/obras/${OBRA_ID}/financeiro`;
export const PAGE_SIZE = 20;

/** O JSON do admin traz `createdByUserId`, que o front não tipa nem exibe (regra 7). */
export const CRIADO_POR = '99999999-9999-9999-9999-999999999999';
export type LancamentoJson = LancamentoAdmin & { createdByUserId: string };

export const anexo = (id: string, over: Partial<LancamentoAnexo> = {}): LancamentoAnexo => ({
  id,
  nomeArquivo: `${id}.pdf`,
  contentType: 'application/pdf',
  tamanhoBytes: 10240,
  uploadedAt: '2026-09-10T13:05:00Z',
  ...over,
});

export const lancamento = (id: string, over: Partial<LancamentoJson> = {}): LancamentoJson => ({
  id,
  obraId: OBRA_ID,
  categoria: 'Material',
  descricao: `Lançamento ${id}`,
  valor: 1500,
  dataLancamento: '2026-09-10',
  mesCompetencia: '2026-09-01',
  createdByUserId: CRIADO_POR,
  visivelCliente: false,
  createdAt: '2026-09-10T13:00:00Z',
  anexos: [],
  ...over,
});

export const CATEGORIAS = [
  { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
  { valor: 'material', rotulo: 'Material' },
  { valor: 'equipamento', rotulo: 'Equipamento' },
];

export const paged = <T>(items: T[], extra: { pageIndex?: number; totalItems?: number } = {}) => ({
  totalItems: extra.totalItems ?? items.length,
  pageIndex: extra.pageIndex ?? 0,
  pageSize: PAGE_SIZE,
  items,
});

/** `n` lançamentos `L01..Ln`, mais novos primeiro (como o backend ordena), alternando liberado/oculto. */
export const lancamentos = (n: number): LancamentoJson[] =>
  Array.from({ length: n }, (_, i) => {
    const numero = String(i + 1).padStart(2, '0');
    return lancamento(`l${numero}`, {
      descricao: `Item ${numero}`,
      valor: 1000 + i,
      visivelCliente: i % 2 === 0,
      dataLancamento: '2026-09-10',
    });
  });

const centavos = (valor: number) => Math.round(valor * 100);

export function resumoDe(lista: LancamentoJson[]): FinanceiroResumo {
  const liberados = lista.filter((l) => l.visivelCliente);
  const soma = (itens: LancamentoJson[]) => itens.reduce((s, l) => s + centavos(l.valor), 0) / 100;
  return {
    totalLancado: soma(lista),
    totalLiberadoCliente: soma(liberados),
    totalNaoLiberado: soma(lista.filter((l) => !l.visivelCliente)),
    quantidadeLancamentos: lista.length,
    quantidadeLiberada: liberados.length,
    quantidadeNaoLiberada: lista.length - liberados.length,
  };
}

const CATEGORIA_SAIDA: Record<string, LancamentoJson['categoria']> = {
  mao_de_obra: 'MaoDeObra',
  material: 'Material',
  equipamento: 'Equipamento',
};

const categoriaEntrada = (c: LancamentoJson['categoria']) =>
  ({ MaoDeObra: 'mao_de_obra', Material: 'material', Equipamento: 'equipamento' })[c as string] ?? c;

export interface ServidorFinanceiro {
  /** Handlers MSW de todas as chamadas da tela. Sobrescreva uma rota com `server.use(...)` depois deles. */
  handlers: ReturnType<typeof http.get>[];
  /** Estado vivo do "servidor" (a lista reflete as escritas). */
  estado: { lancamentos: LancamentoJson[] };
  chamadas: {
    listas: URLSearchParams[];
    resumos: number;
    categorias: number;
    posts: { auth: string; body: Record<string, unknown> }[];
    puts: { id: string; body: Record<string, unknown> }[];
    deletes: string[];
    patches: { id: string; body: Record<string, unknown> }[];
    lotes: { obraId: string; body: { ids: string[]; visivelCliente: boolean } }[];
    uploads: { id: string; auth: string; nome: string; tipo: string; tamanho: number; campo: string }[];
    anexosRemovidos: string[];
    downloads: { id: string; auth: string }[];
  };
}

/**
 * API em memória do módulo Financeiro: lista paginada (20) com filtros, resumo recalculado, categorias e todas as
 * escritas (POST/PUT/DELETE, PATCH unitário e em lote, anexos). A lista só devolve o que o estado tem.
 */
export function servidorFinanceiro(
  inicial: LancamentoJson[] = [],
  /**
   * No jsdom o `File` do app chega ao MSW com o nome "blob" (o `fetch` do Node não conhece o `File` do jsdom). Quem
   * testa upload lê o nome real do `FormData` antes do envio e o informa aqui; no navegador (e2e) o nome vem inteiro.
   */
  opcoes: { nomeDoArquivo?: () => string | undefined } = {},
): ServidorFinanceiro {
  const estado = { lancamentos: inicial.map((l) => ({ ...l, anexos: [...l.anexos] })) };
  const chamadas: ServidorFinanceiro['chamadas'] = {
    listas: [],
    resumos: 0,
    categorias: 0,
    posts: [],
    puts: [],
    deletes: [],
    patches: [],
    lotes: [],
    uploads: [],
    anexosRemovidos: [],
    downloads: [],
  };
  let seq = 0;
  const achar = (id: string) => estado.lancamentos.find((l) => l.id === id);
  const naoEncontrado = () => HttpResponse.json({}, { status: 404 });

  const handlers = [
    http.get(`${API}/obras/${OBRA_ID}/financeiro/lancamentos`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      chamadas.listas.push(params);
      const pageIndex = Number(params.get('pageIndex') ?? 0);
      const pageSize = Number(params.get('pageSize') ?? PAGE_SIZE);
      const visivel = params.get('visivelCliente');
      const categoria = params.get('categoria');
      const competencia = params.get('competencia');
      const filtrados = estado.lancamentos.filter(
        (l) =>
          (visivel === null || String(l.visivelCliente) === visivel) &&
          (categoria === null || categoriaEntrada(l.categoria) === categoria) &&
          (competencia === null || l.mesCompetencia.startsWith(competencia)),
      );
      const items = filtrados.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      return HttpResponse.json({ totalItems: filtrados.length, pageIndex, pageSize, items });
    }),
    http.get(`${API}/obras/${OBRA_ID}/financeiro/resumo`, () => {
      chamadas.resumos += 1;
      return HttpResponse.json(resumoDe(estado.lancamentos));
    }),
    http.get(`${API}/financeiro/categorias`, () => {
      chamadas.categorias += 1;
      return HttpResponse.json(CATEGORIAS);
    }),
    http.post(`${API}/financeiro/lancamentos`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.posts.push({ auth: request.headers.get('Authorization') ?? '', body });
      seq += 1;
      const novo = lancamento(`novo-${seq}`, {
        categoria: CATEGORIA_SAIDA[String(body.categoria)] ?? 'Material',
        descricao: String(body.descricao),
        valor: Number(body.valor),
        dataLancamento: String(body.dataLancamento),
        mesCompetencia: String(body.mesCompetencia),
        visivelCliente: Boolean(body.visivelCliente),
      });
      estado.lancamentos.unshift(novo);
      return HttpResponse.json(novo, { status: 201 });
    }),
    http.put(`${API}/financeiro/lancamentos/:id`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as Record<string, unknown>;
      chamadas.puts.push({ id, body });
      const atual = achar(id);
      if (!atual) return naoEncontrado();
      Object.assign(atual, {
        categoria: CATEGORIA_SAIDA[String(body.categoria)] ?? atual.categoria,
        descricao: String(body.descricao),
        valor: Number(body.valor),
        dataLancamento: String(body.dataLancamento),
        mesCompetencia: String(body.mesCompetencia),
        visivelCliente: Boolean(body.visivelCliente),
      });
      return HttpResponse.json(atual);
    }),
    http.delete(`${API}/financeiro/lancamentos/:id`, ({ params }) => {
      const id = String(params.id);
      chamadas.deletes.push(id);
      if (!achar(id)) return naoEncontrado();
      estado.lancamentos = estado.lancamentos.filter((l) => l.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${API}/financeiro/lancamentos/:id/visibilidade`, async ({ params, request }) => {
      const id = String(params.id);
      const body = (await request.json()) as { visivelCliente: boolean };
      chamadas.patches.push({ id, body });
      const atual = achar(id);
      if (!atual) return naoEncontrado();
      atual.visivelCliente = body.visivelCliente;
      return HttpResponse.json(atual);
    }),
    http.patch(`${API}/obras/${OBRA_ID}/financeiro/lancamentos/visibilidade`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[]; visivelCliente: boolean };
      chamadas.lotes.push({ obraId: OBRA_ID, body });
      const unicos = [...new Set(body.ids)];
      if (unicos.length === 0 || unicos.length > 200 || unicos.some((id) => !achar(id))) {
        return HttpResponse.json(
          { errors: { Ids: ['Um ou mais lancamentos informados nao pertencem a esta obra.'] } },
          { status: 400 },
        );
      }
      unicos.forEach((id) => {
        const l = achar(id);
        if (l) l.visivelCliente = body.visivelCliente;
      });
      return HttpResponse.json({ atualizados: unicos.length, visivelCliente: body.visivelCliente });
    }),
    http.post(`${API}/financeiro/lancamentos/:id/anexos`, async ({ params, request }) => {
      const id = String(params.id);
      const atual = achar(id);
      const form = await request.formData();
      const [campo, valor] = [...form.entries()][0] ?? ['', null];
      const arquivo = valor as File;
      const nomeArquivo = opcoes.nomeDoArquivo?.() ?? arquivo.name;
      chamadas.uploads.push({
        id,
        auth: request.headers.get('Authorization') ?? '',
        nome: nomeArquivo,
        tipo: arquivo.type,
        tamanho: arquivo.size,
        campo,
      });
      if (!atual) return naoEncontrado();
      seq += 1;
      const novo = anexo(`anx-novo-${seq}`, {
        nomeArquivo,
        contentType: arquivo.type,
        tamanhoBytes: arquivo.size,
      });
      atual.anexos = [...atual.anexos, novo];
      return HttpResponse.json(novo, { status: 201 });
    }),
    http.delete(`${API}/financeiro/anexos/:anexoId`, ({ params }) => {
      const anexoId = String(params.anexoId);
      chamadas.anexosRemovidos.push(anexoId);
      const dono = estado.lancamentos.find((l) => l.anexos.some((a) => a.id === anexoId));
      if (!dono) return naoEncontrado();
      dono.anexos = dono.anexos.filter((a) => a.id !== anexoId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${API}/financeiro/anexos/:anexoId/download`, ({ params, request }) => {
      const anexoId = String(params.anexoId);
      chamadas.downloads.push({ id: anexoId, auth: request.headers.get('Authorization') ?? '' });
      return new HttpResponse(Uint8Array.from([37, 80, 68, 70]), { headers: { 'Content-Type': 'application/pdf' } });
    }),
  ] as ReturnType<typeof http.get>[];

  return { handlers, estado, chamadas };
}
