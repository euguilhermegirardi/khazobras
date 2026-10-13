using KhazObras.Application.Abstractions;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeObraAccessService
{
    private readonly FakeObraRepository _obraRepository;

    public FakeObraAccessService(FakeObraRepository obraRepository)
    {
        _obraRepository = obraRepository;
    }

    public async Task EnsureAccessAsync(Guid obraId, Guid userId)
    {
        var obra = await _obraRepository.GetByIdAsync(obraId);

        if (obra == null)
        {
            throw new InvalidOperationException("Obra not found.");
        }

        if (obra.UserId != userId)
        {
            throw new UnauthorizedAccessException("Access denied to this obra.");
        }
    }

    public async Task<bool> HasAccessAsync(Guid obraId, Guid userId)
    {
        var obra = await _obraRepository.GetByIdAsync(obraId);
        return obra?.UserId == userId;
    }
}
