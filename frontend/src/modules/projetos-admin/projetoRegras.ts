/**
 * Regras de upload e de nome de documento de projeto, espelhando `FileUploadValidator` + as regras de `POST/PUT
 * /projetos` do backend (que seguem sendo a fonte: o servidor ainda confere MIME e magic bytes). Aqui só o que dá
 * para recusar antes de enviar. Mais estreito que o anexo de lançamento: sem `.txt`, DWG nem ZIP.
 */
export const PROJETO_MAX_BYTES = 10 * 1024 * 1024;
export const PROJETO_MAX_POR_OBRA = 200;
export const PROJETO_NOME_MAX = 255;
export const PROJETO_TIPO_MAX = 50;

export const PROJETO_EXTENSOES = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
] as const;

/** Valor para o atributo `accept` do `<input type="file">`. */
export const PROJETO_ACCEPT = PROJETO_EXTENSOES.join(',');

/** "PDF, JPG, JPEG, ..." para mensagens. */
export const PROJETO_EXTENSOES_TEXTO = PROJETO_EXTENSOES.map((e) => e.slice(1).toUpperCase()).join(', ');

/** Extensão em minúscula, com ponto ("" se não houver). */
export function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto < 0 ? '' : nome.slice(ponto).toLowerCase();
}

/** Tem barra (`/` ou `\`) ou caractere de controle (0x00-0x1F, 0x7F)? O backend recusa os dois. */
export function temBarraOuControle(texto: string): boolean {
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    if (codigo === 0x2f || codigo === 0x5c || codigo < 0x20 || codigo === 0x7f) return true;
  }
  return false;
}

/** Tem caractere de controle? (o tipo de documento aceita barra, não controle) */
export function temControle(texto: string): boolean {
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    if (codigo < 0x20 || codigo === 0x7f) return true;
  }
  return false;
}

/** Mensagem de erro (em português) ou null se o arquivo pode ser enviado como documento de projeto. */
export function validarProjetoArquivo(arquivo: { name: string; size: number }): string | null {
  if (arquivo.size <= 0) return 'O arquivo está vazio.';
  if (arquivo.size > PROJETO_MAX_BYTES) return 'O arquivo excede o tamanho máximo de 10 MB.';
  if (arquivo.name.trim() === '') return 'O arquivo não tem nome.';
  if (arquivo.name.length > PROJETO_NOME_MAX) {
    return `O nome do arquivo deve ter no máximo ${PROJETO_NOME_MAX} caracteres.`;
  }
  if (temBarraOuControle(arquivo.name))
    return 'O nome do arquivo não pode ter barras (/ ou \\) nem caracteres de controle.';
  if (!(PROJETO_EXTENSOES as readonly string[]).includes(extensaoDe(arquivo.name))) {
    return `Tipo de arquivo não permitido. Use: ${PROJETO_EXTENSOES_TEXTO}.`;
  }
  return null;
}
