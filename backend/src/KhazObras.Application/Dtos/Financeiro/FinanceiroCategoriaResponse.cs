namespace KhazObras.Application.Dtos.Financeiro;

/// <summary>Opcao do select de categoria: <c>Valor</c> e o que o POST/PUT aceitam; <c>Rotulo</c> e o texto da tela.</summary>
public sealed record FinanceiroCategoriaResponse(string Valor, string Rotulo);
