using KhazObras.Application.Abstractions;
using KhazObras.Application.Services;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Security.Tests.Fakes;

namespace KhazObras.Security.Tests;

/// <summary>
/// Base class for integration tests providing common setup and fake repositories.
/// </summary>
public abstract class IntegrationTestBase
{
    protected FakeUserRepository UserRepository { get; }
    protected FakeObraRepository ObraRepository { get; }
    protected FakeEtapaRepository EtapaRepository { get; }
    protected FakeMedicaoRepository MedicaoRepository { get; }
    protected FakeFinanceiroRepository FinanceiroRepository { get; }
    protected FakeRelatorioMensalRepository RelatorioMensalRepository { get; }
    protected FakeUserObraRepository UserObraRepository { get; }
    protected FakeObraAccessService ObraAccessService { get; }

    // Test IDs
    protected readonly Guid AdminUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    protected readonly Guid ClientUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    protected readonly Guid AnotherClientUserId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    protected readonly Guid ObraId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    protected readonly Guid EtapaId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    protected readonly Guid MedicaoId = Guid.Parse("66666666-6666-6666-6666-666666666666");

    protected IntegrationTestBase()
    {
        UserRepository = new FakeUserRepository();
        ObraRepository = new FakeObraRepository();
        EtapaRepository = new FakeEtapaRepository();
        MedicaoRepository = new FakeMedicaoRepository();
        FinanceiroRepository = new FakeFinanceiroRepository();
        RelatorioMensalRepository = new FakeRelatorioMensalRepository();
        UserObraRepository = new FakeUserObraRepository();
        ObraAccessService = new FakeObraAccessService(UserObraRepository);
    }

    /// <summary>
    /// Create a test admin user.
    /// </summary>
    protected virtual async Task<User> CreateAdminUserAsync()
    {
        var user = new User
        {
            Id = AdminUserId,
            Email = "admin@test.com",
            Name = "Admin User",
            PasswordHash = "hashed_password",
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };

        await UserRepository.CreateAsync(user);
        return user;
    }

    /// <summary>
    /// Create a test client user.
    /// </summary>
    protected virtual async Task<User> CreateClientUserAsync(Guid? id = null)
    {
        var userId = id ?? ClientUserId;
        var user = new User
        {
            Id = userId,
            Email = $"client-{userId:N}@test.com",
            Name = "Client User",
            PasswordHash = "hashed_password",
            Role = UserRole.Client,
            CreatedAt = DateTime.UtcNow
        };

        await UserRepository.CreateAsync(user);
        return user;
    }

    /// <summary>
    /// Create a test obra.
    /// </summary>
    protected virtual async Task<Obra> CreateObraAsync(Guid? id = null)
    {
        var obraId = id ?? ObraId;

        var obra = new Obra
        {
            Id = obraId,
            Nome = "Test Obra",
            Endereco = "Rua Teste, 123",
            ValorContratado = 100000m,
            DataInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            DataPrevisaoTermino = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await ObraRepository.CreateAsync(obra);
        return obra;
    }

    /// <summary>
    /// Create a test etapa.
    /// </summary>
    protected virtual async Task<Etapa> CreateEtapaAsync(Guid? obraId = null, Guid? id = null)
    {
        var etapaId = id ?? EtapaId;
        var obra_Id = obraId ?? ObraId;

        var etapa = new Etapa
        {
            Id = etapaId,
            ObraId = obra_Id,
            Nome = "Test Etapa",
            Ordem = 1,
            PercentualPeso = 25m,
            DataInicioPrevista = DateOnly.FromDateTime(DateTime.UtcNow),
            DataFimPrevista = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(28)),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await EtapaRepository.CreateAsync(etapa);
        return etapa;
    }

    /// <summary>
    /// Create a test medicao.
    /// </summary>
    protected virtual async Task<Medicao> CreateMedicaoAsync(Guid? obraId = null, Guid? etapaId = null, Guid? id = null)
    {
        var medicaoId = id ?? MedicaoId;
        var obra_Id = obraId ?? ObraId;

        var medicao = new Medicao
        {
            Id = medicaoId,
            ObraId = obra_Id,
            EtapaId = etapaId,
            Numero = 1,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            ValorTotal = 5000m,
            Status = MedicaoStatus.PendingApproval,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Itens = new List<MedicaoItem>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    MedicaoId = medicaoId,
                    Tipo = ItemTipo.MaoDeObra,
                    Descricao = "Test Item",
                    Quantidade = 10,
                    ValorUnitario = 500m,
                    ValorTotal = 5000m
                }
            }
        };

        await MedicaoRepository.CreateAsync(medicao);
        return medicao;
    }
}
