import { COR_BARRA, COR_LINHA, NOME_BARRA, NOME_LINHA } from '../constants';

/** Legenda feita à mão com as mesmas constantes de cor e as mesmas formas do gráfico (barra e linha com ponto). */
export const CustoAcumuladoLegenda = () => (
  <ul aria-label="Legenda do gráfico" className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: COR_BARRA }} />
      {NOME_BARRA}
    </li>
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="relative flex h-2.5 w-4 items-center">
        <span className="h-0.5 w-full rounded-full" style={{ backgroundColor: COR_LINHA }} />
        <span
          className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: COR_LINHA }}
        />
      </span>
      {NOME_LINHA}
    </li>
  </ul>
);
