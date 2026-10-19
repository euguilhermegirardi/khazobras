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
/// PUT /etapas/{id}: so Admin/Master (cliente 403, anonimo 401), etapa inexistente 404, validacao 400,
/// UPDATE preso a obra e GET devolvendo percentualConcluido.
/// </summary>
public sealed class EtapaAtualizacaoTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public EtapaAtualizacaoTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(HttpClient Client, FakeEtapaRepository Etapas, Guid ObraId, Guid OutraObraId, Guid ClienteId, Guid EtapaId, Guid EtapaOutraObraId);

    private static async Task<Guid> SeedAsync(FakeEtapaRepository etapas, Guid obraId, string nome, int ordem)
    {
        var etapa = await etapas.CreateAsync(new Etapa
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            Nome = nome,
            Ordem = ordem,
            PercentualPeso = 25m,
            Status = "nao_iniciada",
            PercentualConcluido = 0m,
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
        var etapaId = await SeedAsync(etapas, obraId, "Fundacao", 1);
        var daOutra = await SeedAsync(etapas, outraObraId, "Etapa alheia", 1);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<IUserObraRepository>(vinculos);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, etapas, obraId, outraObraId, clienteId, etapaId, daOutra);
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

    private static object Corpo(
        string nome = "Fundacao revisada",
        int ordem = 2,
        decimal peso = 30m,
        string status = "em_andamento",
        decimal percentual = 40m,
        string? inicioPrevista = "2026-01-10",
        string? fimPrevista = "2026-02-10",
        string? inicioReal = "2026-01-12",
        string? fimReal = null) => new
        {
            nome,
            ordem,
            percentualPeso = peso,
            dataInicioPrevista = inicioPrevista,
            dataFimPrevista = fimPrevista,
            dataInicioReal = inicioReal,
            dataFimReal = fimReal,
            status,
            percentualConcluido = percentual
        };

    [Fact]
    public async Task Anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", null, body: Corpo());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_da_obra_recebe_403_e_nada_e_alterado()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", UserRole.Client, c.ClienteId, Corpo());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var etapa = await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId);
        Assert.Equal("Fundacao", etapa!.Nome);
        Assert.Equal("nao_iniciada", etapa.Status);
        Assert.Equal(0m, etapa.PercentualConcluido);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_atualizam_e_valores_sao_persistidos(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", role, body: Corpo());
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("em_andamento", root.GetProperty("status").GetString());
        Assert.Equal(40m, root.GetProperty("percentualConcluido").GetDecimal());

        var etapa = await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId);
        Assert.Equal("Fundacao revisada", etapa!.Nome);
        Assert.Equal(2, etapa.Ordem);
        Assert.Equal(30m, etapa.PercentualPeso);
        Assert.Equal(40m, etapa.PercentualConcluido);
        Assert.Equal("em_andamento", etapa.Status);
        Assert.Equal(new DateOnly(2026, 1, 12), etapa.DataInicioReal);
        Assert.Null(etapa.DataFimReal);
        Assert.Equal(c.ObraId, etapa.ObraId);
    }

    [Fact]
    public async Task Etapa_concluida_com_datas_reais_e_aceita()
    {
        var c = await CriarCenarioAsync();
        var corpo = Corpo(status: "concluida", percentual: 100m, inicioReal: "2026-01-12", fimReal: "2026-02-15");

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", UserRole.Admin, body: corpo);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var etapa = await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId);
        Assert.Equal(new DateOnly(2026, 2, 15), etapa!.DataFimReal);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Etapa_inexistente_retorna_404(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{Guid.NewGuid()}", role, body: Corpo());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    public static IEnumerable<object[]> CorposInvalidos() =>
    [
        [Corpo(percentual: 101m)],
        [Corpo(percentual: -1m)],
        [Corpo(peso: 101m)],
        [Corpo(ordem: 0)],
        [Corpo(nome: "")],
        [Corpo(nome: new string('x', 151))],
        [Corpo(status: "pausada")],
        [Corpo(fimPrevista: "2026-01-01")],
        [Corpo(inicioReal: "2026-03-01", fimReal: "2026-02-01", status: "concluida", percentual: 100m)],
        // coerencia status x percentual
        [Corpo(status: "nao_iniciada", percentual: 10m, inicioReal: null)],
        [Corpo(status: "concluida", percentual: 80m, fimReal: "2026-02-15")],
        [Corpo(status: "em_andamento", percentual: 100m)],
        // coerencia status x datas reais
        [Corpo(status: "nao_iniciada", percentual: 0m, inicioReal: "2026-01-12")],
        [Corpo(status: "em_andamento", percentual: 40m, inicioReal: null)],
        [Corpo(status: "em_andamento", percentual: 40m, fimReal: "2026-02-01")],
        [Corpo(status: "concluida", percentual: 100m, fimReal: null)]
    ];

    [Theory]
    [MemberData(nameof(CorposInvalidos))]
    public async Task Corpo_invalido_recebe_400_e_nada_e_alterado(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", UserRole.Admin, body: corpo);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var etapa = await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId);
        Assert.Equal("Fundacao", etapa!.Nome);
        Assert.Equal("nao_iniciada", etapa.Status);
    }

    [Fact]
    public async Task Update_do_repositorio_e_preso_a_obra()
    {
        var c = await CriarCenarioAsync();
        var original = (await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId))!;

        var obraErrada = new Etapa
        {
            Id = original.Id,
            ObraId = c.OutraObraId,
            Nome = "Invasao",
            Ordem = 9,
            Status = "concluida",
            PercentualConcluido = 100m,
            CreatedAt = original.CreatedAt,
            UpdatedAt = DateTime.UtcNow
        };

        Assert.False(await c.Etapas.UpdateAsync(obraErrada));

        var depois = await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.ObraId);
        Assert.Equal("Fundacao", depois!.Nome);
        Assert.Equal("nao_iniciada", depois.Status);
        Assert.Null(await c.Etapas.GetByIdAndObraAsync(c.EtapaId, c.OutraObraId));
    }

    [Fact]
    public async Task Put_nao_altera_etapa_de_outra_obra()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", UserRole.Admin, body: Corpo());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var alheia = await c.Etapas.GetByIdAndObraAsync(c.EtapaOutraObraId, c.OutraObraId);
        Assert.Equal("Etapa alheia", alheia!.Nome);
        Assert.Equal("nao_iniciada", alheia.Status);
    }

    [Fact]
    public async Task Get_detalhe_e_lista_devolvem_percentual_concluido_ao_cliente()
    {
        var c = await CriarCenarioAsync();
        using var put = await SendAsync(c, HttpMethod.Put, $"/etapas/{c.EtapaId}", UserRole.Admin, body: Corpo());
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/etapas/{c.EtapaId}", UserRole.Client, c.ClienteId);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/etapas", UserRole.Client, c.ClienteId);
        var detalheJson = JsonDocument.Parse(await detalhe.Content.ReadAsStringAsync()).RootElement;
        var listaJson = JsonDocument.Parse(await lista.Content.ReadAsStringAsync()).RootElement;

        Assert.Equal(40m, detalheJson.GetProperty("percentualConcluido").GetDecimal());
        Assert.Equal(40m, listaJson[0].GetProperty("percentualConcluido").GetDecimal());
        Assert.Equal("em_andamento", listaJson[0].GetProperty("status").GetString());
    }
}
