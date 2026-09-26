using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public UserRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, name, email, password_hash AS PasswordHash, role,
                   invited_by_user_id AS InvitedByUserId, is_active AS IsActive,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM users
            WHERE email = @Email";

        var row = await connection.QuerySingleOrDefaultAsync<UserRow>(sql, new { Email = email });
        return row?.ToEntity();
    }

    public async Task<User?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, name, email, password_hash AS PasswordHash, role,
                   invited_by_user_id AS InvitedByUserId, is_active AS IsActive,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM users
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<UserRow>(sql, new { Id = id });
        return row?.ToEntity();
    }

    public async Task<User> CreateAsync(User user)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO users (id, name, email, password_hash, role, invited_by_user_id, is_active, created_at, updated_at)
            VALUES (@Id, @Name, @Email, @PasswordHash, @Role::user_role, @InvitedByUserId, @IsActive, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            user.Id,
            user.Name,
            user.Email,
            user.PasswordHash,
            Role = user.Role.ToString().ToLowerInvariant(),
            user.InvitedByUserId,
            user.IsActive,
            user.CreatedAt,
            user.UpdatedAt
        });

        return user;
    }

    private sealed class UserRow
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public Guid? InvitedByUserId { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public User ToEntity() => new()
        {
            Id = Id,
            Name = Name,
            Email = Email,
            PasswordHash = PasswordHash,
            Role = Enum.Parse<UserRole>(Role, ignoreCase: true),
            InvitedByUserId = InvitedByUserId,
            IsActive = IsActive,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }
}