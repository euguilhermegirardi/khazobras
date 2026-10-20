/**
 * Erros do 400 (`{ errors: { Numero: [msg] } }`) para os campos do formulário. `mapa` liga a chave do servidor
 * (minúscula) ao nome do campo; o que não casar vai em `gerais` (a tela mostra num Alert).
 */
export function mapServerErrors<Campo extends string>(
  fieldErrors: Record<string, string[]> | undefined,
  mapa: Record<string, Campo>,
): { campos: Partial<Record<Campo, string>>; gerais: string[] } {
  const campos: Partial<Record<Campo, string>> = {};
  const gerais: string[] = [];
  for (const [chave, mensagens] of Object.entries(fieldErrors ?? {})) {
    const campo = mapa[chave.toLowerCase()];
    if (campo) campos[campo] = mensagens.join(' ');
    else gerais.push(...mensagens);
  }
  return { campos, gerais };
}
