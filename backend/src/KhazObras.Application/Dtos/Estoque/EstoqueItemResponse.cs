namespace KhazObras.Application.Dtos.Estoque;

public sealed record EstoqueItemResponse(Guid Id, Guid ObraId, string Nome, string Unidade, decimal QuantidadeAtual, DateTime CreatedAt);