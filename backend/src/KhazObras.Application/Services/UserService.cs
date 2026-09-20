using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Users;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public sealed class UserService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;

    public UserService(IUserRepository userRepository, IPasswordHasher passwordHasher)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request, Guid createdByUserId)
    {
        var existing = await _userRepository.GetByEmailAsync(request.Email);
        if (existing is not null)
        {
            throw new InvalidOperationException("Ja existe um usuario com esse e-mail.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Email = request.Email,
            PasswordHash = _passwordHasher.Hash(request.Password),
            Role = Enum.Parse<UserRole>(request.Role, ignoreCase: true),
            InvitedByUserId = createdByUserId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _userRepository.CreateAsync(user);

        return new UserResponse(created.Id, created.Name, created.Email, created.Role.ToString(), created.IsActive, created.CreatedAt);
    }
}