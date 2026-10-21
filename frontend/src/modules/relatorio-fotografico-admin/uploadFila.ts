import { FOTO_MAX_POR_RELATORIO, validarFoto } from '@/utils/foto';

/** Estado de uma foto na fila de envio (um POST por arquivo, em sequência). */
export type UploadStatus = 'pendente' | 'enviando' | 'enviada' | 'erro' | 'cancelada';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  /** Mensagem do servidor (400 `{ message }`) ou da rede; só com `status = 'erro'`. */
  erro?: string;
}

/** Arquivo que nem entrou na fila (tipo, tamanho, nome, repetido ou acima do limite do relatório). */
export interface UploadRecusado {
  nome: string;
  motivo: string;
}

export type UploadAcao =
  | { tipo: 'adicionar'; itens: UploadItem[] }
  | { tipo: 'status'; id: string; status: UploadStatus; erro?: string }
  | { tipo: 'remover'; id: string }
  | { tipo: 'cancelar' }
  | { tipo: 'repetir' }
  | { tipo: 'limpar' };

export interface ResumoFila {
  total: number;
  pendentes: number;
  enviando: number;
  enviadas: number;
  falhas: number;
  canceladas: number;
  /** 0 a 100: enviadas + falhas + canceladas sobre o total (o que já foi resolvido). */
  progresso: number;
}

const mesmoArquivo = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Valida os arquivos escolhidos e separa os que entram na fila dos recusados. O limite de 100 por relatório conta as
 * fotos que o servidor já tem (`jaNoRelatorio`) mais as que estão na fila esperando ou sendo enviadas; o que passar
 * do limite é recusado, na ordem de escolha (o servidor ainda confere: 400 na 101ª). `novoId` gera o id de cada item.
 */
export function prepararItens(
  fila: UploadItem[],
  arquivos: File[],
  jaNoRelatorio: number,
  novoId: () => string,
): { itens: UploadItem[]; recusados: UploadRecusado[] } {
  const itens: UploadItem[] = [];
  const recusados: UploadRecusado[] = [];
  const naFila = fila.filter((i) => i.status === 'pendente' || i.status === 'enviando');
  let vagas = FOTO_MAX_POR_RELATORIO - jaNoRelatorio - naFila.length;

  for (const file of arquivos) {
    const invalido = validarFoto(file);
    if (invalido) {
      recusados.push({ nome: file.name, motivo: invalido });
    } else if ([...naFila, ...itens].some((i) => mesmoArquivo(i.file, file))) {
      recusados.push({ nome: file.name, motivo: 'Este arquivo já está na fila de envio.' });
    } else if (vagas <= 0) {
      recusados.push({
        nome: file.name,
        motivo: `Limite de ${FOTO_MAX_POR_RELATORIO} fotos por relatório atingido.`,
      });
    } else {
      vagas -= 1;
      itens.push({ id: novoId(), file, status: 'pendente' });
    }
  }
  return { itens, recusados };
}

/** Primeira foto ainda pendente (a fila anda na ordem em que os arquivos foram escolhidos). */
export function proximoPendente(fila: UploadItem[]): UploadItem | undefined {
  return fila.find((i) => i.status === 'pendente');
}

/** Transições da fila. `enviando` só é trocado pelo envio; "limpar" tira o que já terminou (inclusive falhas). */
export function filaReducer(fila: UploadItem[], acao: UploadAcao): UploadItem[] {
  switch (acao.tipo) {
    case 'adicionar':
      return [...fila, ...acao.itens];
    case 'status':
      return fila.map((i) => (i.id === acao.id ? { ...i, status: acao.status, erro: acao.erro } : i));
    case 'remover':
      // O que está sendo enviado não sai da fila (o envio termina de qualquer jeito).
      return fila.filter((i) => i.id !== acao.id || i.status === 'enviando');
    case 'cancelar':
      return fila.map((i): UploadItem => (i.status === 'pendente' ? { ...i, status: 'cancelada' } : i));
    case 'repetir':
      return fila.map((i): UploadItem => (i.status === 'erro' ? { ...i, status: 'pendente', erro: undefined } : i));
    case 'limpar':
      return fila.filter((i) => i.status === 'pendente' || i.status === 'enviando');
  }
}

export function resumoFila(fila: UploadItem[]): ResumoFila {
  const conta = (status: UploadStatus) => fila.filter((i) => i.status === status).length;
  const [pendentes, enviando, enviadas, falhas, canceladas] = [
    conta('pendente'),
    conta('enviando'),
    conta('enviada'),
    conta('erro'),
    conta('cancelada'),
  ];
  const total = fila.length;
  const resolvidos = enviadas + falhas + canceladas;
  return {
    total,
    pendentes,
    enviando,
    enviadas,
    falhas,
    canceladas,
    progresso: total === 0 ? 0 : Math.round((resolvidos / total) * 100),
  };
}
