namespace KhazObras.Application.Dtos.Fornecedores;

public sealed record CreateFornecedorRequest(string Nome, string? CnpjCpf, string? Contato);