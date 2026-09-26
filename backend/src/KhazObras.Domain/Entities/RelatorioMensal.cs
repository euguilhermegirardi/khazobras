namespace KhazObras.Domain.Entities;

public sealed class RelatorioMensal
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public DateOnly Competencia { get; set; }
    public string Conteudo { get; set; } = string.Empty;
    public string Status { get; set; } = "draft"; // "draft" ou "published"
    public DateTime? PublishedAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}