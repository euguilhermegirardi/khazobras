namespace KhazObras.Application.Dtos.Fornecedores;

public sealed record FornecedorResponse(Guid Id, string Nome, string? CnpjCpf, string? Contato, DateTime CreatedAt);