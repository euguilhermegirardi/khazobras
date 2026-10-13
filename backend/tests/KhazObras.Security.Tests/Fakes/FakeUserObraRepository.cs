using KhazObras.Application.Abstractions;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeUserObraRepository : IUserObraRepository
{
    private readonly Dictionary<(Guid UserId, Guid ObraId), bool> _userObraLinks = [];

    public Task LinkAsync(Guid userId, Guid obraId)
    {
        _userObraLinks[(userId, obraId)] = true;
        return Task.CompletedTask;
    }

    public Task<bool> HasAccessAsync(Guid userId, Guid obraId)
    {
        var hasAccess = _userObraLinks.ContainsKey((userId, obraId));
        return Task.FromResult(hasAccess);
    }

    public Task<IReadOnlyList<Guid>> GetObraIdsForUserAsync(Guid userId)
    {
        var obraIds = _userObraLinks
            .Where(kvp => kvp.Key.UserId == userId)
            .Select(kvp => kvp.Key.ObraId)
            .ToList()
            .AsReadOnly();

        return Task.FromResult((IReadOnlyList<Guid>)obraIds);
    }
}
