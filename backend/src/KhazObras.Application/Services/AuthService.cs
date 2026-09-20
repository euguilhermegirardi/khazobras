using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auth;

namespace KhazObras.Application.Services;

public sealed class AuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _tokenGenerator;

    public AuthService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator tokenGenerator)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _tokenGenerator = tokenGenerator;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email);

        if (user is null || !user.IsActive)
        {
            return null;
        }

        if (!_passwordHasher.Verify(user.PasswordHash, request.Password))
        {
            return null;
        }

        var (token, expiresAt) = _tokenGenerator.Generate(user);

        return new LoginResponse(token, expiresAt, user.Id, user.Name, user.Email, user.Role.ToString());
    }
}