using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IJwtTokenGenerator
{
    (string Token, DateTime ExpiresAt) Generate(User user);
}