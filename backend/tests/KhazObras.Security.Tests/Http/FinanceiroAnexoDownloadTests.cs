using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Services;
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
/// Download autenticado de comprovante do financeiro: cliente so baixa da propria obra e so de lancamento liberado
/// (oculto = 404, sem revelar que existe), outra obra = 403, anonimo = 401, anexo inexistente = 404, admin baixa tudo.
/// O filtro (anexo + obra + visibilidade) e uma unica consulta; o arquivo so e lido do storage depois das checagens.
/// </summary>
public sealed class FinanceiroAnexoDownloadTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FinanceiroAnexoDownloadTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client,
        FakeFinanceiroRepository Financeiro,
        CapturingStorageService Storage,
        Guid ObraId,
        Guid ClienteId,
        Guid LancamentoLiberadoId,
        Guid AnexoLiberadoId,
        Guid LancamentoOcultoId,
        Guid AnexoOcultoId);

    private sealed class CapturingStorageService : IStorageService
    {
        public List<string> Uploads { get; } = [];
        public List<string> Downloads { get; } = [];

        public Task<string> UploadAsync(string key, Stream content, string contentType)
        {
            Uploads.Add(key);
            return Task.FromResult(key);
        }

        public Task<Stream> DownloadAsync(string key)
        {
            Downloads.Add(key);
            return Task.FromResult<Stream>(new MemoryStream());
        }

        public Task DeleteAsync(string key) => Task.CompletedTask;
    }

    private static async Task<(Guid LancamentoId, Guid AnexoId)> SeedAsync(FakeFinanceiroRepository financeiro, Guid obraId, bool visivel)
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
        var anexo = await financeiro.AddAnexoAsync(new FinanceiroLancamentoAnexo
        {
            Id = Guid.NewGuid(),
            LancamentoId = lancamento.Id,
            NomeArquivo = "nota-fiscal.pdf",
            StorageKey = $"obras/{obraId}/financeiro/{lancamento.Id}/{Guid.NewGuid()}.pdf",
            ContentType = "application/pdf",
            TamanhoBytes = 10,
            UploadedAt = DateTime.UtcNow
        });
        return (lancamento.Id, anexo.Id);
    }

    private async Task<Cenario> CriarCenarioAsync()
    {
        var financeiro = new FakeFinanceiroRepository();
        var vinculos = new FakeUserObraRepository();
        var storage = new CapturingStorageService();
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
                services.AddSingleton<IStorageService>(storage);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, financeiro, storage, obraId, clienteId, liberado.LancamentoId, liberado.AnexoId, oculto.LancamentoId, oculto.AnexoId);
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
    public async Task Anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_e_nada_e_lido_do_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_tambem_para_anexo_de_lancamento_oculto()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoOcultoId}/download", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Cliente_da_obra_com_lancamento_nao_liberado_recebe_404_e_nada_e_lido_do_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoOcultoId}/download", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Cliente_da_obra_com_lancamento_liberado_baixa_o_comprovante()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.Single(c.Storage.Downloads);
        Assert.Contains("nosniff", response.Headers.GetValues("X-Content-Type-Options"));
    }

    [Fact]
    public async Task Cliente_deixa_de_baixar_quando_o_admin_oculta_o_lancamento()
    {
        var c = await CriarCenarioAsync();
        await c.Financeiro.SetVisibilidadeClienteAsync(c.LancamentoLiberadoId, c.ObraId, false);

        using var response = await GetAsync(c, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_baixam_anexo_liberado_e_oculto(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var liberado = await GetAsync(c, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", role);
        using var oculto = await GetAsync(c, $"/financeiro/anexos/{c.AnexoOcultoId}/download", role);

        Assert.Equal(HttpStatusCode.OK, liberado.StatusCode);
        Assert.Equal(HttpStatusCode.OK, oculto.StatusCode);
        Assert.Equal(2, c.Storage.Downloads.Count);
    }

    [Theory]
    [InlineData(UserRole.Client)]
    [InlineData(UserRole.Admin)]
    public async Task Anexo_inexistente_retorna_404(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/financeiro/anexos/{Guid.NewGuid()}/download", role, role == UserRole.Client ? c.ClienteId : null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Service_nao_devolve_anexo_de_outra_obra_nem_oculto_para_cliente()
    {
        var c = await CriarCenarioAsync();
        var service = new FinanceiroService(c.Financeiro, c.Storage, new FakeObraRepository(), new LogAuditoriaService(new FakeLogAuditoriaRepository()));

        var certo = await service.DownloadAnexoAsync(c.AnexoLiberadoId, c.ObraId, somenteVisiveisCliente: true);
        var obraErrada = await service.DownloadAnexoAsync(c.AnexoLiberadoId, Guid.NewGuid(), somenteVisiveisCliente: false);
        var ocultoParaCliente = await service.DownloadAnexoAsync(c.AnexoOcultoId, c.ObraId, somenteVisiveisCliente: true);
        var ocultoParaAdmin = await service.DownloadAnexoAsync(c.AnexoOcultoId, c.ObraId, somenteVisiveisCliente: false);

        Assert.NotNull(certo);
        Assert.Equal("nota-fiscal.pdf", certo!.Value.FileName);
        Assert.Null(obraErrada);
        Assert.Null(ocultoParaCliente);
        Assert.NotNull(ocultoParaAdmin);
    }

    [Fact]
    public async Task Upload_grava_chave_sem_nome_original_e_o_download_devolve_o_nome_do_anexo()
    {
        var c = await CriarCenarioAsync();
        using var body = new MultipartFormDataContent();
        var pdf = new ByteArrayContent("%PDF-1.4 conteudo"u8.ToArray());
        pdf.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(pdf, "file", "Comprovante Secreto.PDF");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/financeiro/lancamentos/{c.LancamentoLiberadoId}/anexos") { Content = body };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(UserRole.Admin));

        using var response = await c.Client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var chave = Assert.Single(c.Storage.Uploads);
        Assert.EndsWith(".pdf", chave);
        Assert.DoesNotContain("Secreto", chave, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Comprovante", chave, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Comprovante Secreto.PDF", JsonDocument.Parse(json).RootElement.GetProperty("nomeArquivo").GetString());
    }
}
