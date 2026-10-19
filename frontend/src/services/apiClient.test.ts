import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { fakeSession } from '@/test/helpers';
import { API, server } from '@/test/server';
import { ApiError, apiDownload, apiRequest } from './apiClient';
import { loadSession, saveSession } from './session';

async function failure(path: string): Promise<ApiError> {
  try {
    await apiRequest(path);
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error('Era esperado um ApiError.');
}

describe('apiClient', () => {
  it('envia o token da sessao no header Authorization', async () => {
    saveSession(fakeSession('Client'));
    let received: string | null = null;
    server.use(
      http.get(`${API}/obras`, ({ request }) => {
        received = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiRequest('/obras');

    expect(received).toBe('Bearer token-falso-de-teste');
  });

  it('401 encerra a sessao', async () => {
    saveSession(fakeSession('Client'));
    server.use(http.get(`${API}/obras`, () => new HttpResponse(null, { status: 401 })));

    const error = await failure('/obras');

    expect(error.kind).toBe('unauthorized');
    expect(loadSession()).toBeNull();
  });

  it('403 vira erro de permissao', async () => {
    server.use(http.get(`${API}/obras`, () => new HttpResponse(null, { status: 403 })));
    expect((await failure('/obras')).kind).toBe('forbidden');
  });

  it('409 devolve a mensagem de transicao invalida do backend', async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.json({ message: 'Medição já aprovada.' }, { status: 409 })));

    const error = await failure('/x');

    expect(error.kind).toBe('conflict');
    expect(error.message).toBe('Medição já aprovada.');
  });

  it('500 expoe o requestId para suporte', async () => {
    server.use(
      http.get(`${API}/x`, () =>
        HttpResponse.json({ requestId: 'abc-123', message: 'Erro interno.' }, { status: 500 }),
      ),
    );

    const error = await failure('/x');

    expect(error.kind).toBe('server');
    expect(error.requestId).toBe('abc-123');
  });

  it('falha de rede vira erro de rede', async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.error()));
    expect((await failure('/x')).kind).toBe('network');
  });

  it('204 devolve undefined', async () => {
    server.use(http.post(`${API}/x`, () => new HttpResponse(null, { status: 204 })));
    expect(await apiRequest('/x', { method: 'POST', body: {} })).toBeUndefined();
  });

  it('download decodifica o nome de arquivo do Content-Disposition', async () => {
    server.use(
      http.get(
        `${API}/f`,
        () =>
          new HttpResponse('x', { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''obra%20a.jpg" } }),
      ),
    );
    expect((await apiDownload('/f')).fileName).toBe('obra a.jpg');
  });

  it('download com nome malformado nao falha e devolve o valor cru', async () => {
    server.use(
      http.get(
        `${API}/f`,
        () =>
          new HttpResponse('x', { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''obra%20100%.jpg" } }),
      ),
    );
    const result = await apiDownload('/f');
    expect(result.fileName).toBe('obra%20100%.jpg');
    expect(result.blob.size).toBe(1);
  });
});
