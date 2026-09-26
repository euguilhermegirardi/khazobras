namespace KhazObras.Application.Abstractions;

public interface IUserObraRepository
{
    Task LinkAsync(Guid userId, Guid obraId);
    Task<bool> HasAccessAsync(Guid userId, Guid obraId);
    Task<IReadOnlyList<Guid>> GetObraIdsForUserAsync(Guid userId);
}