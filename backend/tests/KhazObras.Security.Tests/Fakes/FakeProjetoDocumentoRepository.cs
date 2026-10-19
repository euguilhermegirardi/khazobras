using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeProjetoDocumentoRepository : IProjetoDocumentoRepository
{
    private readonly List<ProjetoDocumento> _documentos = [];

    public Task<ProjetoDocumento> CreateAsync(ProjetoDocumento documento)
    {
        _documentos.Add(documento);
        return Task.FromResult(documento);
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        var documento = _documentos.FirstOrDefault(d => d.Id == id);
        return Task.FromResult<Guid?>(documento?.ObraId);
    }

    public Task<ProjetoDocumento?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var documento = _documentos.FirstOrDefault(d => d.Id == id && d.ObraId == obraId);
        return Task.FromResult(documento);
    }

    public Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId)
    {
        var documentos = _documentos
            .Where(d => d.ObraId == obraId)
            .OrderByDescending(d => d.UploadedAt)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<ProjetoDocumento>>(documentos);
    }
}
