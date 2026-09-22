namespace KhazObras.Domain.Entities;

public sealed class Etapa
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public int Ordem { get; set; }
    public decimal PercentualPeso { get; set; }
    public DateOnly? DataInicioPrevista { get; set; }
    public DateOnly? DataInicioReal { get; set; }
    public DateOnly? DataFimPrevista { get; set; }
    public DateOnly? DataFimReal { get; set; }
    public string Status { get; set; } = "nao_iniciada";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}