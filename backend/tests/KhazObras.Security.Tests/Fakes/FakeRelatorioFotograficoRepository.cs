using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>Repositorio em memoria que espelha o SQL real: tudo preso a obra, limite, tudo-ou-nada no lote.</summary>
public sealed class FakeRelatorioFotograficoRepository : IRelatorioFotograficoRepository
{
    private readonly List<RelatorioFotografico> _relatorios = [];

    /// <summary>Faz o INSERT da foto lancar (simula queda do banco depois do upload ao storage).</summary>
    public bool FalharAoAdicionarFoto { get; set; }

    public int TotalRelatorios => _relatorios.Count;

    public int TotalFotos => _relatorios.Sum(r => r.Fotos.Count);

    public Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio)
    {
        _relatorios.Add(relatorio);
        return Task.FromResult(relatorio);
    }

    /// <summary>Estado cru (so para os testes inspecionarem/semearem; o codigo de producao usa GetByIdAndObraAsync).</summary>
    public RelatorioFotografico? Inspecionar(Guid id) => _relatorios.FirstOrDefault(r => r.Id == id);

    public Foto? InspecionarFoto(Guid fotoId) => _relatorios.SelectMany(r => r.Fotos).FirstOrDefault(f => f.Id == fotoId);

    /// <summary>Semeia uma foto direto (sem passar pelo limite).</summary>
    public Task<Foto> AddFotoAsync(Foto foto)
    {
        _relatorios.First(r => r.Id == foto.RelatorioFotograficoId).Fotos.Add(foto);
        return Task.FromResult(foto);
    }

    public Task<Guid?> GetObraIdByIdAsync(Guid id) =>
        Task.FromResult<Guid?>(_relatorios.FirstOrDefault(r => r.Id == id)?.ObraId);

    public Task<RelatorioFotografico?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId);
        return Task.FromResult(relatorio is null ? null : Copia(relatorio));
    }

    public Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId)
    {
        var relatorios = _relatorios
            .Where(r => r.ObraId == obraId)
            .OrderByDescending(r => r.CreatedAt)
            .ThenBy(r => r.Id)
            .Select(Copia)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<RelatorioFotografico>>(relatorios);
    }

    public Task<bool> UpdateAsync(RelatorioFotografico relatorio)
    {
        // Espelha o SQL: WHERE id = @Id AND obra_id = @ObraId
        var atual = _relatorios.FirstOrDefault(r => r.Id == relatorio.Id && r.ObraId == relatorio.ObraId);
        if (atual is null)
        {
            return Task.FromResult(false);
        }

        atual.Tipo = relatorio.Tipo;
        atual.EtapaId = relatorio.EtapaId;
        atual.Titulo = relatorio.Titulo;
        atual.Competencia = relatorio.Competencia;
        return Task.FromResult(true);
    }

    public Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == id && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult<IReadOnlyList<string>?>(null);
        }

        _relatorios.Remove(relatorio);
        return Task.FromResult<IReadOnlyList<string>?>(relatorio.Fotos.Select(f => f.StorageKey).ToList());
    }

    public Task<int?> CountFotosAsync(Guid relatorioId, Guid obraId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == relatorioId && r.ObraId == obraId);
        return Task.FromResult<int?>(relatorio?.Fotos.Count);
    }

    public Task<FotoInsertResult> TryAddFotoAsync(Foto foto, Guid obraId, int maxFotos, bool ordemNoFim)
    {
        if (FalharAoAdicionarFoto)
        {
            throw new InvalidOperationException("Banco indisponivel");
        }

        var relatorio = _relatorios.FirstOrDefault(r => r.Id == foto.RelatorioFotograficoId && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult(FotoInsertResult.RelatorioNaoEncontrado);
        }

        if (relatorio.Fotos.Count >= maxFotos)
        {
            return Task.FromResult(FotoInsertResult.LimiteExcedido);
        }

        if (ordemNoFim)
        {
            foto.Ordem = relatorio.Fotos.Count == 0 ? 0 : relatorio.Fotos.Max(f => f.Ordem) + 1;
        }

        relatorio.Fotos.Add(foto);
        return Task.FromResult(FotoInsertResult.Added);
    }

    public Task<Guid?> GetObraIdByFotoIdAsync(Guid fotoId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Fotos.Any(f => f.Id == fotoId));
        return Task.FromResult<Guid?>(relatorio?.ObraId);
    }

    public Task<Foto?> GetFotoByIdAndObraAsync(Guid fotoId, Guid obraId)
    {
        var foto = _relatorios
            .Where(r => r.ObraId == obraId)
            .SelectMany(r => r.Fotos)
            .FirstOrDefault(f => f.Id == fotoId);
        return Task.FromResult(foto);
    }

    public Task<Foto?> UpdateFotoAsync(Guid fotoId, Guid obraId, UpdateFotoRequest patch)
    {
        var foto = _relatorios
            .Where(r => r.ObraId == obraId)
            .SelectMany(r => r.Fotos)
            .FirstOrDefault(f => f.Id == fotoId);
        if (foto is null)
        {
            return Task.FromResult<Foto?>(null);
        }

        if (patch.DescricaoInformada) foto.Descricao = patch.Descricao;
        if (patch.DataFotoInformada) foto.DataFoto = patch.DataFoto;
        if (patch.OrdemInformada) foto.Ordem = patch.Ordem;
        return Task.FromResult<Foto?>(foto);
    }

    public Task<Foto?> DeleteFotoAsync(Guid fotoId, Guid obraId)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.ObraId == obraId && r.Fotos.Any(f => f.Id == fotoId));
        var foto = relatorio?.Fotos.First(f => f.Id == fotoId);
        if (relatorio is null || foto is null)
        {
            return Task.FromResult<Foto?>(null);
        }

        relatorio.Fotos.Remove(foto);
        return Task.FromResult<Foto?>(foto);
    }

    public Task<bool> ReordenarFotosAsync(Guid relatorioId, Guid obraId, IReadOnlyList<(Guid Id, int Ordem)> itens)
    {
        var relatorio = _relatorios.FirstOrDefault(r => r.Id == relatorioId && r.ObraId == obraId);
        if (relatorio is null)
        {
            return Task.FromResult(false);
        }

        // Tudo-ou-nada: todas as fotos precisam ser deste relatorio, senao nada muda.
        var fotos = itens.Select(i => relatorio.Fotos.FirstOrDefault(f => f.Id == i.Id)).ToList();
        if (fotos.Any(f => f is null))
        {
            return Task.FromResult(false);
        }

        for (var i = 0; i < itens.Count; i++)
        {
            fotos[i]!.Ordem = itens[i].Ordem;
        }

        return Task.FromResult(true);
    }

    // Ordem estavel (ordem, criacao, id), como o ORDER BY do SQL; devolve copia para o chamador nao mutar o estado.
    private static RelatorioFotografico Copia(RelatorioFotografico r) => new()
    {
        Id = r.Id,
        ObraId = r.ObraId,
        Tipo = r.Tipo,
        EtapaId = r.EtapaId,
        Titulo = r.Titulo,
        Competencia = r.Competencia,
        CreatedAt = r.CreatedAt,
        Fotos = r.Fotos.OrderBy(f => f.Ordem).ThenBy(f => f.CreatedAt).ThenBy(f => f.Id).ToList()
    };
}
