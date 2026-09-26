namespace KhazObras.Domain.Entities;

public sealed class RelatorioFotografico
{
    public Guid Id { get; set; }
    public Guid ObraId { get; set; }
    public string Tipo { get; set; } = string.Empty; // "mensal" ou "etapa"
    public Guid? EtapaId { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public DateOnly? Competencia { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Foto> Fotos { get; set; } = [];
}