namespace KhazObras.Domain.Entities;

public sealed class Fornecedor
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? CnpjCpf { get; set; }
    public string? Contato { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}