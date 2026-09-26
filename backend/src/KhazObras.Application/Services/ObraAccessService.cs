using System.Security.Claims;
using KhazObras.Application.Abstractions;

namespace KhazObras.Application.Services;

public sealed class ObraAccessService
{
    private readonly IUserObraRepository _userObraRepository;

    public ObraAccessService(IUserObraRepository userObraRepository) => _userObraRepository = userObraRepository;

    /// <summary>
    /// Master/Admin sempre tem acesso. Client so tem acesso a obras vinculadas em user_obra.
    /// Lanca UnauthorizedAccessException se o acesso for negado.
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

    public bool IsAdminOrMaster(ClaimsPrincipal principal)
    {
        var role = principal.FindFirst(ClaimTypes.Role)?.Value;
        return role is "Master" or "Admin";
    }
}