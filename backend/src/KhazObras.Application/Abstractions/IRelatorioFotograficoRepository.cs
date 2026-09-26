using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IRelatorioFotograficoRepository
{
    Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio);
    Task<RelatorioFotografico?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId);
    Task<Foto> AddFotoAsync(Foto foto);
}