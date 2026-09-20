namespace KhazObras.Application.Dtos.Common;

public sealed record PagedResult<T>(
    int TotalItems,
    int PageIndex,
    int PageSize,
    IReadOnlyList<T> Items);