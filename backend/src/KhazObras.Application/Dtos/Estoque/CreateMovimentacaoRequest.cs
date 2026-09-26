namespace KhazObras.Application.Dtos.Estoque;

public sealed record CreateMovimentacaoRequest(string Tipo, decimal Quantidade, DateOnly Data);