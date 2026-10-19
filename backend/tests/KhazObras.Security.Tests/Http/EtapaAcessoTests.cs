using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
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
/// Etapas (cronograma): leitura por id e por obra so com acesso a obra (403), inexistente = 404, anonimo = 401,
/// criacao so Admin/Master (cliente = 403), lista ordenada por ordem e presa a obra.
/// </summary>
public sealed class EtapaAcessoTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public EtapaAcessoTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(HttpClient Client, FakeEtapaRepository Etapas, Guid ObraId, Guid OutraObraId, Guid ClienteId, Guid EtapaId, Guid EtapaOutraObraId);

    private static async Task<Guid> SeedAsync(FakeEtapaRepository etapas, Guid obraId, string nome, int ordem, DateOnly? inicio = null)
    {
        var etapa = await etapas.CreateAsync(new Etapa
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            Nome = nome,
            Ordem = ordem,
            PercentualPeso = 25m,
            DataInicioPrevista = inicio,
            Status = "nao_iniciada",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        return etapa.Id;
    }

    private async Task<Cenario> CriarCenarioAsync()
    {
        var etapas = new FakeEtapaRepository();
        var vinculos = new FakeUserObraRepository();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await SeedAsync(etapas, obraId, "Fundacao", 2);
        var primeira = await SeedAsync(etapas, obraId, "Projeto", 1);
        var daOutra = await SeedAsync(etapas, outraObraId, "Etapa alheia", 1);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<IUserObraRepository>(vinculos);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, etapas, obraId, outraObraId, clienteId, primeira, daOutra);
    }

    private static async Task<HttpResponseMessage> SendAsync(Cenario c, HttpMethod method, string url, UserRole? role, Guid? userId = null, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await c.Client.SendAsync(request);
    }

    [Fact]
    public async Task Anonimo_recebe_401_em_detalhe_e_lista()
    {
        var c = await CriarCenarioAsync();

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaId}", null);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/etapas", null);

        Assert.Equal(HttpStatusCode.Unauthorized, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, lista.StatusCode);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_em_detalhe_e_lista()
    {
        var c = await CriarCenarioAsync();
        var outroCliente = Guid.NewGuid();

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaId}", UserRole.Client, outroCliente);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/etapas", UserRole.Client, outroCliente);

        Assert.Equal(HttpStatusCode.Forbidden, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, lista.StatusCode);
    }

    [Fact]
    public async Task Cliente_da_obra_nao_le_etapa_de_outra_obra()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaOutraObraId}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_da_obra_le_detalhe_e_lista_ordenada_so_da_propria_obra()
    {
        var c = await CriarCenarioAsync();

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaId}", UserRole.Client, c.ClienteId);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/etapas", UserRole.Client, c.ClienteId);
        var itens = JsonDocument.Parse(await lista.Content.ReadAsStringAsync()).RootElement;

        Assert.Equal(HttpStatusCode.OK, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.OK, lista.StatusCode);
        Assert.Equal(2, itens.GetArrayLength());
        Assert.Equal("Projeto", itens[0].GetProperty("nome").GetString());
        Assert.Equal("Fundacao", itens[1].GetProperty("nome").GetString());
        Assert.All(itens.EnumerateArray(), i => Assert.Equal(c.ObraId, i.GetProperty("obraId").GetGuid()));
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_leem_etapa_de_qualquer_obra(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaOutraObraId}", role);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Client)]
    [InlineData(UserRole.Admin)]
    public async Task Etapa_inexistente_retorna_404(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/etapas/{Guid.NewGuid()}", role, role == UserRole.Client ? c.ClienteId : null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Resposta_nao_expoe_campos_internos_alem_do_contrato()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaId}", UserRole.Client, c.ClienteId);
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        var nomes = root.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        Assert.DoesNotContain("updatedAt", nomes);
        Assert.DoesNotContain("createdByUserId", nomes);
        Assert.Contains("percentualPeso", nomes);
    }

    [Fact]
    public async Task Post_etapa_por_cliente_recebe_403_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();
        var corpo = new { obraId = c.ObraId, nome = "Nova", ordem = 3, percentualPeso = 10m };

        using var response = await SendAsync(c, HttpMethod.Post, "/etapas", UserRole.Client, c.ClienteId, corpo);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(2, (await c.Etapas.GetByObraIdAsync(c.ObraId)).Count);
    }

    [Fact]
    public async Task Post_etapa_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();
        var corpo = new { obraId = c.ObraId, nome = "Nova", ordem = 3, percentualPeso = 10m };

        using var response = await SendAsync(c, HttpMethod.Post, "/etapas", null, body: corpo);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Post_etapa_por_admin_ou_master_recebe_201(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var corpo = new { obraId = c.ObraId, nome = "Nova", ordem = 3, percentualPeso = 10m };

        using var response = await SendAsync(c, HttpMethod.Post, "/etapas", role, body: corpo);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(3, (await c.Etapas.GetByObraIdAsync(c.ObraId)).Count);
    }

    [Fact]
    public async Task Post_etapa_invalida_por_admin_recebe_400()
    {
        var c = await CriarCenarioAsync();
        var corpo = new { obraId = c.ObraId, nome = "", ordem = 3, percentualPeso = 10m };

        using var response = await SendAsync(c, HttpMethod.Post, "/etapas", UserRole.Admin, body: corpo);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Repositorio_nao_devolve_etapa_quando_a_obra_nao_e_a_dela()
    {
        var c = await CriarCenarioAsync();

        Assert.Null(await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.OutraObraId));
        Assert.NotNull(await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId));
    }
}
