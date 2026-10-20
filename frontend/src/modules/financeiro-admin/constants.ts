import type { CategoriaOpcao, LancamentosFiltros } from '@/interfaces/financeiroAdmin';

export const PAGE_SIZE = 20;

/** Máximo de ids por PATCH em lote (o backend recusa mais). A página tem 20, então a trava é só defesa. */
export const LOTE_MAX = 200;

export const DESCRICAO_MAX_LENGTH = 255;

export const FILTROS_VAZIOS: LancamentosFiltros = { visivelCliente: '', categoria: '', competencia: '' };

export const VISIBILIDADE_OPCOES: { value: LancamentosFiltros['visivelCliente']; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Liberados ao cliente' },
  { value: 'false', label: 'Ocultos do cliente' },
];

/**
 * Categorias de reserva (enum `item_tipo` do backend): usadas se `GET /financeiro/categorias` falhar,
 * para o formulário não ficar sem opção. Os valores são os mesmos que o endpoint devolve.
 */
export const CATEGORIAS_PADRAO: CategoriaOpcao[] = [
  { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
  { valor: 'material', rotulo: 'Material' },
  { valor: 'equipamento', rotulo: 'Equipamento' },
];

/** `yyyy-MM` completo (o `<input type="month">` entrega vazio ou assim; navegador sem suporte deixa digitar qualquer coisa). */
export const COMPETENCIA_FILTRO = /^\d{4}-(0[1-9]|1[0-2])$/;
