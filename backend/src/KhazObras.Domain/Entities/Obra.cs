using KhazObras.Domain.Enums;

namespace KhazObras.Domain.Entities;

public sealed class Obra
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Endereco { get; set; }
    public decimal ValorContratado { get; set; }
    public DateOnly? DataInicio { get; set; }
    public DateOnly? DataPrevisaoTermino { get; set; }
    public ObraStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}