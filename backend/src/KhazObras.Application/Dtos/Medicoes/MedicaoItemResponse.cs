namespace KhazObras.Application.Dtos.Medicoes;

public sealed record MedicaoItemResponse(
    Guid Id,
    string Tipo,
    string Descricao,
    decimal Quantidade,
    decimal ValorUnitario,
    decimal ValorTotal);