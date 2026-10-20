import { useQuery } from '@tanstack/react-query';
import { getContrato, listContratos } from './api';

// Prefixo `['obra', id, 'contratos']`: o admin invalida estas chaves depois de criar contrato/pagamento.
export const useContratos = (obraId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'contratos', 'lista'] as const,
    queryFn: ({ signal }) => listContratos(obraId, signal),
  });

export const useContratoDetalhe = (obraId: string, contratoId: string) =>
  useQuery({
    queryKey: ['obra', obraId, 'contratos', 'detalhe', contratoId] as const,
    queryFn: ({ signal }) => getContrato(contratoId, signal),
  });
