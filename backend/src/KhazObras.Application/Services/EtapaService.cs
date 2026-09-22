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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _etapaRepository.CreateAsync(etapa);
        return ToResponse(created);
    }

    public async Task<EtapaResponse?> GetByIdAsync(Guid id)
    {
        var etapa = await _etapaRepository.GetByIdAsync(id);
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
        e.Status, e.CreatedAt);
}