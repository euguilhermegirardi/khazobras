using KhazObras.Domain.Enums;

namespace KhazObras.Application.Abstractions;

/// <summary>
/// Filtros opcionais da lista ADMIN de lancamentos (todos viram parametros do SQL). Competencia e o mes inteiro:
/// <c>mes_competencia</c> entre o dia 1 do mes e o dia 1 do mes seguinte (exclusivo).
/// </summary>
public sealed record FinanceiroFiltro(bool? VisivelCliente = null, ItemTipo? Categoria = null, DateOnly? Competencia = null);
