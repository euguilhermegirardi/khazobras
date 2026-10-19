import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listObras } from './api';

export const useObras = (pageIndex: number, pageSize: number) =>
  useQuery({
    queryKey: ['obras', pageIndex, pageSize] as const,
    queryFn: ({ signal }) => listObras(pageIndex, pageSize, signal),
    // Trocar de página mantém a lista anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });
