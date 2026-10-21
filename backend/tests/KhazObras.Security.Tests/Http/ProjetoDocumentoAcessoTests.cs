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
/// Projetos (documentos tecnicos): download autenticado pela API, liberado ao cliente da obra (outra obra = 403,
/// sem ler o storage), inexistente = 404, anonimo = 401; upload so Admin/Master, com etapa da mesma obra.
/// </summary>
public sealed class ProjetoDocumentoAcessoTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ProjetoDocumentoAcessoTests(ApiFactory factory) => _factory = factory;

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

    private sealed record Cenario(
        HttpClient Client,
        FakeProjetoDocumentoRepository Documentos,
        FakeEtapaRepository Etapas,
        CapturingStorageService Storage,
        Guid ObraId,
        Guid OutraObraId,
        Guid ClienteId,
        Guid DocumentoId,
        Guid EtapaId,
        Guid EtapaOutraObraId);

    private async Task<Cenario> CriarCenarioAsync()
    {
        var documentos = new FakeProjetoDocumentoRepository();
        var etapas = new FakeEtapaRepository();
        var vinculos = new FakeUserObraRepository();
        var storage = new CapturingStorageService();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var etapaId = Guid.NewGuid();
        var etapaOutraId = Guid.NewGuid();
        var documentoId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await etapas.CreateAsync(NovaEtapa(etapaId, obraId));
        await etapas.CreateAsync(NovaEtapa(etapaOutraId, outraObraId));
        await documentos.CreateAsync(new ProjetoDocumento
        {
            Id = documentoId,
            ObraId = obraId,
            EtapaId = etapaId,
            Nome = "planta-baixa.pdf",
            StorageKey = $"obras/{obraId}/projetos/{Guid.NewGuid()}.pdf",
            TipoDocumento = "planta",
            UploadedAt = DateTime.UtcNow
        });

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IProjetoDocumentoRepository>(documentos);
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IStorageService>(storage);
                services.AddSingleton<ILogAuditoriaRepository>(new FakeLogAuditoriaRepository());
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, documentos, etapas, storage, obraId, outraObraId, clienteId, documentoId, etapaId, etapaOutraId);
    }

    private static Etapa NovaEtapa(Guid id, Guid obraId) => new()
    {
        Id = id,
        ObraId = obraId,
        Nome = "Fundacao",
        Ordem = 1,
        PercentualPeso = 25m,
        Status = "nao_iniciada",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static async Task<HttpResponseMessage> GetAsync(Cenario c, string url, UserRole? role, Guid? userId = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> UploadAsync(Cenario c, Guid obraId, Guid? etapaId, UserRole? role, Guid? userId = null, string fileName = "Planta Secreta.PDF")
    {
        var body = new MultipartFormDataContent();
        var pdf = new ByteArrayContent("%PDF-1.4 conteudo"u8.ToArray());
        pdf.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(pdf, "file", fileName);
        var url = $"/obras/{obraId}/projetos" + (etapaId is null ? string.Empty : $"?etapaId={etapaId}");
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = body };
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    // ---- download ----

    [Fact]
    public async Task Download_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/projetos/{c.DocumentoId}/download", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Download_cliente_de_outra_obra_recebe_403_sem_ler_o_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/projetos/{c.DocumentoId}/download", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Download_cliente_da_obra_recebe_200_com_pdf_nosniff_e_nome_do_documento()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/projetos/{c.DocumentoId}/download", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("nosniff", response.Headers.GetValues("X-Content-Type-Options"));
        Assert.Equal("planta-baixa.pdf", response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        Assert.Single(c.Storage.Downloads);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Download_admin_e_master_recebem_200(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/projetos/{c.DocumentoId}/download", role);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Client)]
    [InlineData(UserRole.Admin)]
    public async Task Download_inexistente_retorna_404(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/projetos/{Guid.NewGuid()}/download", role, role == UserRole.Client ? c.ClienteId : null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Downloads);
    }

    [Fact]
    public async Task Service_nao_devolve_documento_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = new ProjetoDocumentoService(c.Documentos, c.Etapas, c.Storage, new LogAuditoriaService(new FakeLogAuditoriaRepository()));

        var certo = await service.DownloadAsync(c.DocumentoId, c.ObraId);
        var obraErrada = await service.DownloadAsync(c.DocumentoId, c.OutraObraId);

        Assert.NotNull(certo);
        Assert.Null(obraErrada);
        Assert.Single(c.Storage.Downloads);
    }

    [Fact]
    public async Task Service_usa_nome_fixo_quando_o_nome_do_documento_e_inseguro()
    {
        var c = await CriarCenarioAsync();
        var inseguro = await c.Documentos.CreateAsync(new ProjetoDocumento
        {
            Id = Guid.NewGuid(),
            ObraId = c.ObraId,
            Nome = "../../etc/passwd.pdf",
            StorageKey = $"obras/{c.ObraId}/projetos/{Guid.NewGuid()}.pdf",
            UploadedAt = DateTime.UtcNow
        });
        var service = new ProjetoDocumentoService(c.Documentos, c.Etapas, c.Storage, new LogAuditoriaService(new FakeLogAuditoriaRepository()));

        var result = await service.DownloadAsync(inseguro.Id, c.ObraId);

        Assert.Equal($"projeto-{inseguro.Id}.pdf", result!.Value.FileName);
    }

    // ---- lista ----

    [Fact]
    public async Task Lista_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/obras/{c.ObraId}/projetos", UserRole.Client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Lista_do_cliente_da_obra_recebe_200_sem_chave_do_bucket()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetAsync(c, $"/obras/{c.ObraId}/projetos", UserRole.Client, c.ClienteId);
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("storageKey", json, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(c.DocumentoId, JsonDocument.Parse(json).RootElement[0].GetProperty("id").GetGuid());
    }

    // ---- upload ----

    [Fact]
    public async Task Upload_por_cliente_recebe_403_e_nada_vai_ao_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, null, UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_com_etapa_de_outra_obra_recebe_400_e_nada_vai_ao_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, c.EtapaOutraObraId, UserRole.Admin);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_com_etapa_da_mesma_obra_recebe_201_com_chave_sem_nome_original()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, c.EtapaId, UserRole.Admin);
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var chave = Assert.Single(c.Storage.Uploads);
        Assert.EndsWith(".pdf", chave);
        Assert.DoesNotContain("Secreta", chave, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Planta Secreta.PDF", JsonDocument.Parse(json).RootElement.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task Upload_sem_etapa_por_admin_recebe_201()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, null, UserRole.Admin);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Upload_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, null, null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }
}
