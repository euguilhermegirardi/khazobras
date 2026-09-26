namespace KhazObras.Domain.Entities;

public sealed class LogAuditoria
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Acao { get; set; } = string.Empty;
    public string Entidade { get; set; } = string.Empty;
    public Guid? EntidadeId { get; set; }
    public string? Detalhes { get; set; }
    public DateTime CreatedAt { get; set; }
}