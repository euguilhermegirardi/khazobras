namespace KhazObras.Application.Dtos.Medicoes;

public sealed record CreateMedicaoItemRequest(
    string Tipo,
    string Descricao,
    decimal Quantidade,
    decimal ValorUnitario);