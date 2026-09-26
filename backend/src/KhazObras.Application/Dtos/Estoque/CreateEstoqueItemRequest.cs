namespace KhazObras.Application.Dtos.Estoque;

public sealed record CreateEstoqueItemRequest(Guid ObraId, string Nome, string Unidade);