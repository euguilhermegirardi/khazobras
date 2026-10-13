using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeUserRepository : IUserRepository
{
    private readonly List<User> _users = [];

    public Task<User?> GetByEmailAsync(string email)
    {
        var user = _users.FirstOrDefault(u => u.Email == email);
        return Task.FromResult(user);
    }

    public Task<User?> GetByIdAsync(Guid id)
    {
        var user = _users.FirstOrDefault(u => u.Id == id);
        return Task.FromResult(user);
    }

    public Task<User> CreateAsync(User user)
    {
        if (_users.Any(u => u.Email == user.Email))
        {
            throw new InvalidOperationException($"User with email {user.Email} already exists.");
        }

        _users.Add(user);
        return Task.FromResult(user);
    }

    public Task<IReadOnlyList<User>> GetAllAsync()
    {
        return Task.FromResult<IReadOnlyList<User>>(_users.AsReadOnly());
    }
}
