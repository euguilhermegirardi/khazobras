import type { Etapa } from '@/interfaces/etapa';

interface EtapaOpcoesProps {
  etapas: Etapa[];
  /** Etapa já gravada no documento que não está na lista (etapas não carregaram): vira "Etapa atual". */
  etapaAtualId?: string | null;
}

/** `<option>`s de um select de etapa: "Sem etapa" primeiro, depois as etapas da obra na ordem delas. */
export const EtapaOpcoes = ({ etapas, etapaAtualId }: EtapaOpcoesProps) => {
  // Constants derivadas
  const atualDesconhecida = Boolean(etapaAtualId) && !etapas.some((e) => e.id === etapaAtualId);

  // Return
  return (
    <>
      <option value="">Sem etapa</option>
      {atualDesconhecida && etapaAtualId && <option value={etapaAtualId}>Etapa atual</option>}
      {etapas.map((etapa) => (
        <option key={etapa.id} value={etapa.id}>
          {etapa.nome}
        </option>
      ))}
    </>
  );
};
