using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Prestadores;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class PrestadorService
{
    private readonly IPrestadorRepository _repository;

    public PrestadorService(IPrestadorRepository repository) => _repository = repository;

    public async Task<PrestadorResponse> CreateAsync(CreatePrestadorRequest request)
    {
        var prestador = new Prestador
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Nome = request.Nome,
            Funcao = request.Funcao,
            ValorContrato = request.ValorContrato,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(prestador);
        return ToResponse(created);
    }

    public async Task<PrestadorResponse?> GetByIdAsync(Guid id)
    {
        var prestador = await _repository.GetByIdAsync(id);
        return prestador is null ? null : ToResponse(prestador);
    }

    public async Task<IReadOnlyList<PrestadorResponse>> GetByObraIdAsync(Guid obraId)
    {
        var prestadores = await _repository.GetByObraIdAsync(obraId);
        return prestadores.Select(ToResponse).ToList();
    }

    private static PrestadorResponse ToResponse(Prestador p) => new(p.Id, p.ObraId, p.Nome, p.Funcao, p.ValorContrato, p.CreatedAt);
}