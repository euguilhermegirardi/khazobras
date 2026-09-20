namespace KhazObras.Application.Dtos.Users;

public sealed record CreateUserRequest(string Name, string Email, string Password, string Role);