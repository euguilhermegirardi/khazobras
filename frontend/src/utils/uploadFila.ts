/**
 * Fila de envio de arquivos (um POST por arquivo, em sequência), sem saber o que está sendo enviado: fotos de relatório
 * e documentos de projeto usam as mesmas transições. Quem usa informa a validação do arquivo, o limite e a mensagem.
 */

/** Estado de um arquivo na fila de envio. */
export type UploadStatus = 'pendente' | 'enviando' | 'enviada' | 'erro' | 'cancelada';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  /** Mensagem do servidor (400 `{ message }`) ou da rede; só com `status = 'erro'`. */
  erro?: string;
}

/** Arquivo que nem entrou na fila (tipo, tamanho, nome, repetido ou acima do limite). */
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

export interface PrepararItensOpcoes {
  /** Mensagem de recusa (em português) ou null se o arquivo pode entrar na fila. */
  validar: (arquivo: File) => string | null;
  /** Máximo de arquivos no destino (ex.: 100 fotos por relatório, 200 documentos por obra). */
  limite: number;
  /** Quantos arquivos o servidor já tem no destino (conta para o limite). */
  jaNoServidor: number;
  /** Texto de recusa de quem passou do limite. */
  mensagemLimite: string;
  /** Gera o id de cada item. */
  novoId: () => string;
}

function mesmoArquivo(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/** "1 foto" / "3 fotos" (zero é plural). */
export function plural(n: number, singular: string, pluralTxt: string): string {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/**
 * Valida os arquivos escolhidos e separa os que entram na fila dos recusados. O limite conta o que o servidor já tem
 * mais o que está na fila esperando ou sendo enviado; o que passar do limite é recusado, na ordem de escolha (o
 * servidor ainda confere).
 */
export function prepararItens(
  fila: UploadItem[],
  arquivos: File[],
  { validar, limite, jaNoServidor, mensagemLimite, novoId }: PrepararItensOpcoes,
): { itens: UploadItem[]; recusados: UploadRecusado[] } {
  const itens: UploadItem[] = [];
  const recusados: UploadRecusado[] = [];
  const naFila = fila.filter((i) => i.status === 'pendente' || i.status === 'enviando');
  let vagas = limite - jaNoServidor - naFila.length;

  for (const file of arquivos) {
    const invalido = validar(file);
    if (invalido) {
      recusados.push({ nome: file.name, motivo: invalido });
    } else if ([...naFila, ...itens].some((i) => mesmoArquivo(i.file, file))) {
      recusados.push({ nome: file.name, motivo: 'Este arquivo já está na fila de envio.' });
    } else if (vagas <= 0) {
      recusados.push({ nome: file.name, motivo: mensagemLimite });
    } else {
      vagas -= 1;
      itens.push({ id: novoId(), file, status: 'pendente' });
    }
  }
  return { itens, recusados };
}

/** Primeiro arquivo ainda pendente (a fila anda na ordem em que os arquivos foram escolhidos). */
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
  function conta(status: UploadStatus): number {
    return fila.filter((i) => i.status === status).length;
  }
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
