import { ARQUIVO_ICONE, ARQUIVO_ROTULO, arquivoTipo } from '@/utils/arquivoTipo';

interface ArquivoIconeProps {
  /** Nome do arquivo com extensão: o ícone vem dela. */
  nome: string;
}

/** Ícone do tipo do arquivo (PDF, imagem, planilha, outro) com o rótulo para o leitor de tela. */
export const ArquivoIcone = ({ nome }: ArquivoIconeProps) => {
  const tipo = arquivoTipo(nome);
  const Icone = ARQUIVO_ICONE[tipo];
  return <Icone className="size-4 shrink-0 text-muted-foreground" aria-label={ARQUIVO_ROTULO[tipo]} role="img" />;
};
