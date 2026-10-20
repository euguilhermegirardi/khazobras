using System.Net;
using System.Net.Http.Headers;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Security.Tests.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace KhazObras.Security.Tests.Http;

/// <summary>
/// Regra do dono (SPEC secao 5 item 4 e secao 8): o engenheiro gera a medicao, o CLIENTE aprova.
/// Admin/Master nunca aprovam no lugar do cliente (403), e o cliente so aprova medicao de obra vinculada a ele.
/// Pipeline HTTP real; apenas os repositorios de medicao e de vinculo user-obra sao trocados por fakes
/// em memoria (sem banco).
/// </summary>
public sealed class ApproveMedicaoAuthorizationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ApproveMedicaoAuthorizationTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client, FakeMedicaoRepository Medicoes, Guid MedicaoId, Guid ObraId, Guid ClienteDaObraId);

    /// <summary>Uma obra, uma medicao pendente nela e um cliente vinculado a essa obra.</summary>
    private async Task<Cenario> CriarCenarioAsync()
    {
        var medicoes = new FakeMedicaoRepository();
        var vinculos = new FakeUserObraRepository();
        var obraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var medicaoId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await medicoes.CreateAsync(new Medicao
        {
            Id = medicaoId,
            ObraId = obraId,
            Numero = 1,
            Competencia = DateOnly.FromDateTime(DateTime.UtcNow),
            ValorTotal = 1000m,
            Status = MedicaoStatus.PendingApproval,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IMedicaoRepository>(medicoes);
                services.AddSingleton<IUserObraRepository>(vinculos);
                // A aprovacao grava auditoria (SPEC secao 8): sem banco nos testes.
                services.AddSingleton<ILogAuditoriaRepository>(new FakeLogAuditoriaRepository());
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, medicoes, medicaoId, obraId, clienteId);
    }

    private static async Task<HttpStatusCode> AprovarAsync(Cenario c, UserRole role, Guid? userId = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/medicoes/{c.MedicaoId}/approve");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role, userId));

        using var response = await c.Client.SendAsync(request);
        return response.StatusCode;
    }

    [Fact]
    public async Task Admin_nao_aprova_medicao_e_recebe_403()
    {
        var c = await CriarCenarioAsync();

        Assert.Equal(HttpStatusCode.Forbidden, await AprovarAsync(c, UserRole.Admin));
        Assert.Equal(MedicaoStatus.PendingApproval, (await c.Medicoes.GetByIdAsync(c.MedicaoId))!.Status);
    }

    [Fact]
    public async Task Master_nao_aprova_medicao_e_recebe_403()
    {
        var c = await CriarCenarioAsync();

        Assert.Equal(HttpStatusCode.Forbidden, await AprovarAsync(c, UserRole.Master));
        Assert.Equal(MedicaoStatus.PendingApproval, (await c.Medicoes.GetByIdAsync(c.MedicaoId))!.Status);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_nao_aprova_e_recebe_403()
    {
        var c = await CriarCenarioAsync();

        // Cliente sem vinculo com a obra da medicao.
        Assert.Equal(HttpStatusCode.Forbidden, await AprovarAsync(c, UserRole.Client, Guid.NewGuid()));
        Assert.Equal(MedicaoStatus.PendingApproval, (await c.Medicoes.GetByIdAsync(c.MedicaoId))!.Status);
    }

    [Fact]
    public async Task Sem_token_ao_aprovar_retorna_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await c.Client.PostAsync($"/medicoes/{c.MedicaoId}/approve", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_da_obra_aprova_medicao_pendente_e_recebe_200()
    {
        var c = await CriarCenarioAsync();

        Assert.Equal(HttpStatusCode.OK, await AprovarAsync(c, UserRole.Client, c.ClienteDaObraId));

        var medicao = await c.Medicoes.GetByIdAsync(c.MedicaoId);
        Assert.Equal(MedicaoStatus.Approved, medicao!.Status);
        Assert.Equal(c.ClienteDaObraId, medicao.ApprovedByUserId);
    }

    [Fact]
    public async Task Segunda_aprovacao_da_mesma_medicao_retorna_409()
    {
        var c = await CriarCenarioAsync();

        Assert.Equal(HttpStatusCode.OK, await AprovarAsync(c, UserRole.Client, c.ClienteDaObraId));
        Assert.Equal(HttpStatusCode.Conflict, await AprovarAsync(c, UserRole.Client, c.ClienteDaObraId));
    }

    [Fact]
    public async Task Medicao_inexistente_retorna_404_para_o_cliente()
    {
        var c = await CriarCenarioAsync();
        var request = new HttpRequestMessage(HttpMethod.Post, $"/medicoes/{Guid.NewGuid()}/approve");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestTokens.For(UserRole.Client, c.ClienteDaObraId));

        using var response = await c.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
