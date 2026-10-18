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
/// Download autenticado de foto do relatorio fotografico: cliente so baixa da propria obra (403 caso contrario),
/// foto inexistente = 404, anonimo = 401, admin baixa. A resposta de listagem nao expoe a chave do bucket.
/// </summary>
public sealed class FotoDownloadTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FotoDownloadTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(HttpClient Client, Guid ObraId, Guid ClienteId, Guid FotoId);

    private async Task<Cenario> CriarCenarioAsync()
    {
        var relatorios = new FakeRelatorioFotograficoRepository();
        var vinculos = new FakeUserObraRepository();
        var obraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var relatorioId = Guid.NewGuid();
        var fotoId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await relatorios.CreateAsync(new RelatorioFotografico
        {
            Id = relatorioId,
            ObraId = obraId,
            Tipo = "mensal",
            Titulo = "Setembro",
            Competencia = new DateOnly(2026, 9, 1),
            CreatedAt = DateTime.UtcNow
        });
        await relatorios.AddFotoAsync(new Foto
        {
            Id = fotoId,
            RelatorioFotograficoId = relatorioId,
            StorageKey = $"obras/{obraId}/relatorios-fotograficos/{relatorioId}/{Guid.NewGuid()}-fachada.jpg",
            Ordem = 0,
            CreatedAt = DateTime.UtcNow
        });

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IRelatorioFotograficoRepository>(relatorios);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IStorageService>(new FakeStorageService());
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, obraId, clienteId, fotoId);
    }

    private static async Task<HttpResponseMessage> GetAsync(Cenario c, string url, UserRole? role, Guid? userId = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    [Fact]
    public async Task Cliente_da_obra_baixa_a_foto_com_content_type_de_imagem()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/fotos/{c.FotoId}/arquivo", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/fotos/{c.FotoId}/arquivo", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Foto_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/fotos/{Guid.NewGuid()}/arquivo", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/fotos/{c.FotoId}/arquivo", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_baixam_a_foto(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/fotos/{c.FotoId}/arquivo", role);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Listagem_do_cliente_nao_expoe_chave_do_bucket()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/obras/{c.ObraId}/relatorios-fotograficos", UserRole.Client, c.ClienteId);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("storageKey", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("relatorios-fotograficos/", body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(c.FotoId, JsonDocument.Parse(body).RootElement[0].GetProperty("fotos")[0].GetProperty("id").GetGuid());
    }
}
