using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Security;
using Microsoft.Extensions.Configuration;

namespace KhazObras.Security.Tests.Http;

/// <summary>Gera tokens pelo mesmo JwtTokenGenerator da producao (mesmos claims e assinatura).</summary>
public static class TestTokens
{
    public static string For(UserRole role, Guid? userId = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = ApiFactory.JwtSecret,
                ["Jwt:Issuer"] = ApiFactory.Issuer,
                ["Jwt:Audience"] = ApiFactory.Audience
            })
            .Build();

        var user = new User
        {
            Id = userId ?? Guid.NewGuid(),
            Name = $"Teste {role}",
            Email = $"{role.ToString().ToLowerInvariant()}@example.com",
            Role = role,
            IsActive = true
        };

        return new JwtTokenGenerator(configuration).Generate(user).Token;
    }
}
