namespace KhazObras.Application.Dtos.Users;

public sealed record UserResponse(
    Guid Id,
    string Name,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt);