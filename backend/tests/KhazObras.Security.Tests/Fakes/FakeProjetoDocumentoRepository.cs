using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>
/// Espelha o SQL: tudo preso a obra (WHERE id AND obra_id), obra inexistente e limite no TryAdd. A "tabela obras" e o
/// conjunto de obras registradas (por <see cref="RegistrarObra"/> ou implicitamente por <see cref="CreateAsync"/>).
/// </summary>
public sealed class FakeProjetoDocumentoRepository : IProjetoDocumentoRepository
{
    private readonly List<ProjetoDocumento> _documentos = [];
    private readonly HashSet<Guid> _obras = [];

    /// <summary>Simula falha do banco no INSERT (depois do upload ao R2).</summary>
    public bool FalharAoAdicionar { get; set; }

    /// <summary>Simula a corrida: a pre-checagem passa, mas o INSERT travado encontra a obra cheia.</summary>
    public bool EstourarLimiteNaCorrida { get; set; }

    public int Total => _documentos.Count;

    public void RegistrarObra(Guid obraId) => _obras.Add(obraId);

    /// <summary>Semeia um documento direto (helper dos testes, fora da interface).</summary>
    public Task<ProjetoDocumento> CreateAsync(ProjetoDocumento documento)
    {
        _obras.Add(documento.ObraId);
        _documentos.Add(documento);
        return Task.FromResult(documento);
    }

    /// <summary>Estado gravado, sem filtro de obra (so para os testes inspecionarem).</summary>
    public ProjetoDocumento? Inspecionar(Guid id) => _documentos.FirstOrDefault(d => d.Id == id);

    public Task<int?> CountByObraAsync(Guid obraId) =>
        Task.FromResult<int?>(_obras.Contains(obraId) ? _documentos.Count(d => d.ObraId == obraId) : null);

    public Task<ProjetoInsertResult> TryAddAsync(ProjetoDocumento documento, int maxDocumentos)
    {
        if (FalharAoAdicionar)
        {
            throw new InvalidOperationException("banco indisponivel");
        }

        if (!_obras.Contains(documento.ObraId))
        {
            return Task.FromResult(ProjetoInsertResult.ObraNaoEncontrada);
        }

        if (EstourarLimiteNaCorrida || _documentos.Count(d => d.ObraId == documento.ObraId) >= maxDocumentos)
        {
            return Task.FromResult(ProjetoInsertResult.LimiteExcedido);
        }

        _documentos.Add(documento);
        return Task.FromResult(ProjetoInsertResult.Added);
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        var documento = _documentos.FirstOrDefault(d => d.Id == id);
        return Task.FromResult<Guid?>(documento?.ObraId);
    }

    public Task<ProjetoDocumento?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var documento = _documentos.FirstOrDefault(d => d.Id == id && d.ObraId == obraId);
        return Task.FromResult(documento is null ? null : Copiar(documento));
    }

    public Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId)
    {
        var documentos = _documentos
            .Where(d => d.ObraId == obraId)
            .OrderByDescending(d => d.UploadedAt)
            .ThenBy(d => d.Nome, StringComparer.Ordinal)
            .ThenBy(d => d.Id)
            .Select(Copiar)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<ProjetoDocumento>>(documentos);
    }

    public Task<ProjetoDocumento?> UpdateAsync(Guid id, Guid obraId, string nome, string? tipoDocumento, Guid? etapaId)
    {
        // Espelha o SQL: WHERE id = @Id AND obra_id = @ObraId
        var documento = _documentos.FirstOrDefault(d => d.Id == id && d.ObraId == obraId);
        if (documento is null)
        {
            return Task.FromResult<ProjetoDocumento?>(null);
        }

        documento.Nome = nome;
        documento.TipoDocumento = tipoDocumento;
        documento.EtapaId = etapaId;
        return Task.FromResult<ProjetoDocumento?>(Copiar(documento));
    }

    public Task<ProjetoDocumento?> DeleteAsync(Guid id, Guid obraId)
    {
        var documento = _documentos.FirstOrDefault(d => d.Id == id && d.ObraId == obraId);
        if (documento is null)
        {
            return Task.FromResult<ProjetoDocumento?>(null);
        }

        _documentos.Remove(documento);
        return Task.FromResult<ProjetoDocumento?>(Copiar(documento));
    }

    private static ProjetoDocumento Copiar(ProjetoDocumento d) => new()
    {
        Id = d.Id,
        ObraId = d.ObraId,
        EtapaId = d.EtapaId,
        Nome = d.Nome,
        StorageKey = d.StorageKey,
        TipoDocumento = d.TipoDocumento,
        UploadedAt = d.UploadedAt
    };
}
