namespace KhazObras.Domain.Entities;

public sealed class Notificacao
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public Guid UserId { get; set; }
    public List<string> Modulos { get; set; } = [];
    public string Canal { get; set; } = string.Empty;
    public DateTime EnviadoAt { get; set; }
    public DateTime? LidaAt { get; set; }
}