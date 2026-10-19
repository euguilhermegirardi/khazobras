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
/// Detalhe, listagem e visibilidade de lancamentos do financeiro: acesso por obra (403), cliente so ve liberado
/// (oculto = 404, filtro no SQL), PATCH de visibilidade preso a obra e limites de paginacao (400).
/// </summary>
public sealed class FinanceiroLancamentoAcessoTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FinanceiroLancamentoAcessoTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client,
        FakeFinanceiroRepository Financeiro,
        Guid ObraId,
        Guid ClienteId,
        Guid LiberadoId,
        Guid OcultoId);

    private static async Task<Guid> SeedAsync(FakeFinanceiroRepository financeiro, Guid obraId, bool visivel)
    {
        var lancamento = await financeiro.CreateAsync(new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            Categoria = ItemTipo.Material,
            Descricao = "Cimento",
            Valor = 1500m,
            DataLancamento = new DateOnly(2026, 9, 10),
            MesCompetencia = new DateOnly(2026, 9, 1),
            CreatedByUserId = Guid.NewGuid(),
            VisivelCliente = visivel,
            CreatedAt = DateTime.UtcNow
        });
        return lancamento.Id;
    }

    private async Task<Cenario> CriarCenarioAsync()
    {
        var financeiro = new FakeFinanceiroRepository();
        var vinculos = new FakeUserObraRepository();
        var obraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        var liberado = await SeedAsync(financeiro, obraId, visivel: true);
        var oculto = await SeedAsync(financeiro, obraId, visivel: false);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IFinanceiroLancamentoRepository>(financeiro);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IStorageService>(new FakeStorageService());
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, financeiro, obraId, clienteId, liberado, oculto);
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

    // ---- GET /financeiro/lancamentos/{id} ----

    [Fact]
    public async Task Detalhe_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{c.LiberadoId}", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Detalhe_cliente_da_obra_com_lancamento_oculto_recebe_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{c.OcultoId}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Detalhe_cliente_de_outra_obra_recebe_403(bool liberado)
    {
        var c = await CriarCenarioAsync();
        var id = liberado ? c.LiberadoId : c.OcultoId;

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{id}", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Detalhe_cliente_com_lancamento_liberado_recebe_200_sem_campos_internos()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.ClienteId);
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("createdByUserId", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("visivelCliente", json, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(c.LiberadoId, JsonDocument.Parse(json).RootElement.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Detalhe_admin_ve_lancamento_oculto_com_dto_completo()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{c.OcultoId}", UserRole.Admin);
        var root = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(root.TryGetProperty("createdByUserId", out _));
        Assert.False(root.GetProperty("visivelCliente").GetBoolean());
    }

    [Fact]
    public async Task Detalhe_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/financeiro/lancamentos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- PATCH /financeiro/lancamentos/{id}/visibilidade ----

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Patch_visibilidade_admin_e_master_recebem_200_e_o_valor_muda(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.OcultoId}/visibilidade", role, body: new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
    }

    [Fact]
    public async Task Patch_visibilidade_cliente_recebe_403_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.OcultoId}/visibilidade", UserRole.Client, c.ClienteId, new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
    }

    [Fact]
    public async Task Patch_visibilidade_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.OcultoId}/visibilidade", null, body: new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Patch_visibilidade_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/financeiro/lancamentos/{Guid.NewGuid()}/visibilidade", UserRole.Admin, body: new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Repositorio_nao_altera_visibilidade_quando_a_obra_nao_e_a_do_lancamento()
    {
        var c = await CriarCenarioAsync();

        var alterouObraErrada = await c.Financeiro.SetVisibilidadeClienteAsync(c.OcultoId, Guid.NewGuid(), true);
        var alterouObraCerta = await c.Financeiro.SetVisibilidadeClienteAsync(c.OcultoId, c.ObraId, true);

        Assert.False(alterouObraErrada);
        Assert.True(alterouObraCerta);
    }

    // ---- GET /obras/{id}/financeiro/lancamentos (paginacao) ----

    [Theory]
    [InlineData("pageIndex=-1&pageSize=20")]
    [InlineData("pageIndex=0&pageSize=0")]
    [InlineData("pageIndex=0&pageSize=101")]
    [InlineData("pageIndex=0&pageSize=-5")]
    public async Task Listagem_com_paginacao_invalida_retorna_400(string query)
    {
        var c = await CriarCenarioAsync();

        using var admin = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?{query}", UserRole.Admin);
        using var cliente = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?{query}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.BadRequest, admin.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, cliente.StatusCode);
    }

    [Theory]
    [InlineData("pageIndex=0&pageSize=1")]
    [InlineData("pageIndex=0&pageSize=100")]
    [InlineData("")]
    public async Task Listagem_com_paginacao_valida_retorna_200(string query)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?{query}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Listagem_cliente_de_outra_obra_recebe_403_antes_da_validacao_de_paginacao()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?pageSize=0", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
