using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Common;
using KhazObras.Application.Dtos.Obras;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public sealed class ObraService
{
    private readonly IObraRepository _obraRepository;

    public ObraService(IObraRepository obraRepository)
    {
        _obraRepository = obraRepository;
    }

    public async Task<ObraResponse> CreateAsync(CreateObraRequest request)
    {
        var obra = new Obra
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome,
            Endereco = request.Endereco,
            ValorContratado = request.ValorContratado,
            DataInicio = request.DataInicio,
            DataPrevisaoTermino = request.DataPrevisaoTermino,
            Status = ObraStatus.EmAndamento,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _obraRepository.CreateAsync(obra);
        return ToResponse(created);
    }

    public async Task<ObraResponse?> GetByIdAsync(Guid id)
    {
        var obra = await _obraRepository.GetByIdAsync(id);
        return obra is null ? null : ToResponse(obra);
    }

    public async Task<PagedResult<ObraResponse>> GetPagedAsync(int pageIndex, int pageSize)
    {
        var (items, totalItems) = await _obraRepository.GetPagedAsync(pageIndex, pageSize);
        return new PagedResult<ObraResponse>(totalItems, pageIndex, pageSize, items.Select(ToResponse).ToList());
    }

    private static ObraResponse ToResponse(Obra obra) => new(
        obra.Id, obra.Nome, obra.Endereco, obra.ValorContratado,
        obra.DataInicio, obra.DataPrevisaoTermino, obra.Status.ToString(), obra.CreatedAt);
}