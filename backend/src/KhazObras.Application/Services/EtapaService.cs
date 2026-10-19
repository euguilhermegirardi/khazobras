using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Etapas;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class EtapaService
{
    private readonly IEtapaRepository _etapaRepository;

    public EtapaService(IEtapaRepository etapaRepository)
    {
        _etapaRepository = etapaRepository;
    }

    public async Task<EtapaResponse> CreateAsync(CreateEtapaRequest request)
    {
        var etapa = new Etapa
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Nome = request.Nome,
            Ordem = request.Ordem,
            PercentualPeso = request.PercentualPeso,
            DataInicioPrevista = request.DataInicioPrevista,
            DataFimPrevista = request.DataFimPrevista,
            Status = "nao_iniciada",
            PercentualConcluido = 0m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _etapaRepository.CreateAsync(etapa);
        return ToResponse(created);
    }

    /// <summary>
    /// Atualiza a etapa presa a obra ja autorizada pelo endpoint. Devolve null se a etapa nao for dessa obra.
    /// Nao altera Id, ObraId nem CreatedAt.
    /// </summary>
    public async Task<EtapaResponse?> UpdateAsync(Guid id, Guid obraId, UpdateEtapaRequest request)
    {
        var atual = await _etapaRepository.GetByIdAndObraAsync(id, obraId);
        if (atual is null)
        {
            return null;
        }

        var atualizada = new Etapa
        {
            Id = atual.Id,
            ObraId = atual.ObraId,
            Nome = request.Nome.Trim(),
            Ordem = request.Ordem,
            PercentualPeso = request.PercentualPeso,
            DataInicioPrevista = request.DataInicioPrevista,
            DataFimPrevista = request.DataFimPrevista,
            DataInicioReal = request.DataInicioReal,
            DataFimReal = request.DataFimReal,
            Status = request.Status,
            PercentualConcluido = request.PercentualConcluido,
            CreatedAt = atual.CreatedAt,
            UpdatedAt = DateTime.UtcNow
        };

        var atualizou = await _etapaRepository.UpdateAsync(atualizada);
        return atualizou ? ToResponse(atualizada) : null;
    }

    /// <summary>Resolve so a obra da etapa (query enxuta); o endpoint valida o acesso a ela antes de ler a etapa.</summary>
    public Task<Guid?> ResolveEtapaAsync(Guid id) => _etapaRepository.GetObraIdByIdAsync(id);

    /// <summary>Devolve null se a etapa nao existir ou nao pertencer a obra informada (a mesma que foi autorizada).</summary>
    public async Task<EtapaResponse?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var etapa = await _etapaRepository.GetByIdAndObraAsync(id, obraId);
        return etapa is null ? null : ToResponse(etapa);
    }

    public async Task<IReadOnlyList<EtapaResponse>> GetByObraIdAsync(Guid obraId)
    {
        var etapas = await _etapaRepository.GetByObraIdAsync(obraId);
        return etapas.Select(ToResponse).ToList();
    }

    private static EtapaResponse ToResponse(Etapa e) => new(
        e.Id, e.ObraId, e.Nome, e.Ordem, e.PercentualPeso,
        e.DataInicioPrevista, e.DataInicioReal, e.DataFimPrevista, e.DataFimReal,
        e.Status, e.CreatedAt, e.PercentualConcluido);
}