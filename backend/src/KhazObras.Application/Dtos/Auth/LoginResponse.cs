namespace KhazObras.Application.Dtos.Auth;

public sealed record LoginResponse(
    string Token,
    DateTime ExpiresAt,
    Guid UserId,
    string Name,
    string Email,
    string Role);