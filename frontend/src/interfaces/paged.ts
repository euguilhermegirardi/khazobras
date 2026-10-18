/** Listagens paginadas da API: pageIndex base 0. */
export interface Paged<T> {
  totalItems: number
  pageIndex: number
  pageSize: number
  items: T[]
}
