import { File, FileSpreadsheet, FileText, Image, type LucideIcon } from 'lucide-react';

export type ArquivoTipo = 'pdf' | 'imagem' | 'planilha' | 'outro';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const SPREADSHEET_EXTENSIONS = ['xls', 'xlsx'];

/** Ícone por tipo de arquivo (protótipo: documentos.png). */
export const ARQUIVO_ICONE: Record<ArquivoTipo, LucideIcon> = {
  pdf: FileText,
  imagem: Image,
  planilha: FileSpreadsheet,
  outro: File,
};

/** Rótulo lido por leitor de tela (o ícone é decorativo). */
export const ARQUIVO_ROTULO: Record<ArquivoTipo, string> = {
  pdf: 'PDF',
  imagem: 'Imagem',
  planilha: 'Planilha',
  outro: 'Arquivo',
};

/** Tipo do arquivo pela extensão do nome (o backend também decide o Content-Type pela extensão). */
export const arquivoTipo = (nome: string): ArquivoTipo => {
  const dot = nome.lastIndexOf('.');
  const extension = dot < 0 ? '' : nome.slice(dot + 1).toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'imagem';
  if (SPREADSHEET_EXTENSIONS.includes(extension)) return 'planilha';
  return 'outro';
};

/** Só PDF e imagem abrem no navegador; o resto só baixa. */
export const podeVisualizar = (nome: string): boolean => {
  const tipo = arquivoTipo(nome);
  return tipo === 'pdf' || tipo === 'imagem';
};

export const TITULO_SEM_ETAPA = 'Documentos gerais';
/** Documento de uma etapa que a tela não conseguiu nomear (etapas não carregaram). */
export const TITULO_ETAPA_DESCONHECIDA = 'Outros documentos';
