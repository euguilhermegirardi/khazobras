using System.Security.Claims;
using KhazObras.Application.Abstractions;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeObraAccessService
{
    private readonly FakeUserObraRepository _userObraRepository;

    public FakeObraAccessService(FakeUserObraRepository userObraRepository)
    {
        _userObraRepository = userObraRepository;
    }

    /// <summary>
    /// Verify access to an obra based on role and user-obra link.
    /// Throws UnauthorizedAccessException if access is denied.
    /// </summary>
    public async Task EnsureAccessAsync(ClaimsPrincipal principal, Guid obraId)
    {
        var role = principal.FindFirst(ClaimTypes.Role)?.Value;
        if (role is "Master" or "Admin")
        {
            return;
        }

        var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var hasAccess = await _userObraRepository.HasAccessAsync(userId, obraId);

        if (!hasAccess)
        {
            throw new UnauthorizedAccessException("Usuario nao tem acesso a esta obra.");
        }
    }

    /// <summary>
    /// Check if user is admin or master.
    /// </summary>
    public bool IsAdminOrMaster(ClaimsPrincipal principal)
    {
        var role = principal.FindFirst(ClaimTypes.Role)?.Value;
        return role is "Master" or "Admin";
    }
}
