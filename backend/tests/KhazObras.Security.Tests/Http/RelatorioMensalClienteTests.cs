using System.Net;
using System.Net.Http.Headers;
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
/// B4/B5: cliente so ve relatorios publicados (independente de onlyPublished), rascunho = 404,
/// e a resposta do cliente nao traz createdByUserId. Admin/Master seguem vendo tudo.
/// </summary>
public sealed class RelatorioMensalClienteTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public RelatorioMensalClienteTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(HttpClient Client, Guid ObraId, Guid ClienteId, Guid RascunhoId, Guid PublicadoId);

    private async Task<Cenario> CriarCenarioAsync()
    {
        var relatorios = new FakeRelatorioMensalRepository();
        var vinculos = new FakeUserObraRepository();
        var obraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var rascunhoId = Guid.NewGuid();
        var publicadoId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await relatorios.CreateAsync(Novo(rascunhoId, obraId, "draft", new DateOnly(2026, 9, 1), null));
        await relatorios.CreateAsync(Novo(publicadoId, obraId, "published", new DateOnly(2026, 8, 1), DateTime.UtcNow));

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IRelatorioMensalRepository>(relatorios);
                services.AddSingleton<IUserObraRepository>(vinculos);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, obraId, clienteId, rascunhoId, publicadoId);
    }

    private static RelatorioMensal Novo(Guid id, Guid obraId, string status, DateOnly competencia, DateTime? publishedAt) => new()
    {
        Id = id,
        ObraId = obraId,
        Competencia = competencia,
        Conteudo = "texto",
        Status = status,
        PublishedAt = publishedAt,
        CreatedByUserId = Guid.NewGuid(),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static async Task<(HttpStatusCode Status, string Body)> GetAsync(Cenario c, string url, UserRole role, Guid? userId = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role, userId));
        using var response = await c.Client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static List<JsonElement> Itens(string body) => JsonDocument.Parse(body).RootElement.EnumerateArray().ToList();

    [Fact]
    public async Task Cliente_sem_onlyPublished_nao_ve_rascunho()
    {
        var c = await CriarCenarioAsync();

        var (status, body) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, status);
        var itens = Itens(body);
        Assert.Single(itens);
        Assert.Equal(c.PublicadoId, itens[0].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Cliente_com_onlyPublished_false_explicito_nao_ve_rascunho()
    {
        var c = await CriarCenarioAsync();

        var (status, body) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais?onlyPublished=false", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Single(Itens(body));
    }

    [Fact]
    public async Task Cliente_get_por_id_de_rascunho_retorna_404()
    {
        var c = await CriarCenarioAsync();

        var (status, _) = await GetAsync(c, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, status);
    }

    [Fact]
    public async Task Cliente_get_por_id_de_publicado_retorna_200()
    {
        var c = await CriarCenarioAsync();

        var (status, _) = await GetAsync(c, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_na_lista_e_por_id()
    {
        var c = await CriarCenarioAsync();
        var outro = Guid.NewGuid();

        var (lista, _) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais", UserRole.Client, outro);
        var (porId, _) = await GetAsync(c, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Client, outro);
        var (rascunho, _) = await GetAsync(c, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Client, outro);

        Assert.Equal(HttpStatusCode.Forbidden, lista);
        Assert.Equal(HttpStatusCode.Forbidden, porId);
        Assert.Equal(HttpStatusCode.Forbidden, rascunho);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_ainda_veem_rascunho_na_lista_e_por_id(UserRole role)
    {
        var c = await CriarCenarioAsync();

        var (status, body) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais", role);
        var (porId, bodyId) = await GetAsync(c, $"/relatorios-mensais/{c.RascunhoId}", role);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(2, Itens(body).Count);
        Assert.Equal(HttpStatusCode.OK, porId);
        Assert.True(JsonDocument.Parse(bodyId).RootElement.TryGetProperty("createdByUserId", out _));
    }

    [Fact]
    public async Task Admin_com_onlyPublished_true_continua_filtrando()
    {
        var c = await CriarCenarioAsync();

        var (_, body) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais?onlyPublished=true", UserRole.Admin);

        Assert.Single(Itens(body));
    }

    [Fact]
    public async Task Resposta_do_cliente_nao_contem_createdByUserId()
    {
        var c = await CriarCenarioAsync();

        var (_, lista) = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-mensais", UserRole.Client, c.ClienteId);
        var (_, porId) = await GetAsync(c, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Client, c.ClienteId);

        Assert.DoesNotContain("createdByUserId", lista, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("createdByUserId", porId, StringComparison.OrdinalIgnoreCase);
    }
}
