using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.ProjetosDocumentos;
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
/// Projetos admin (tela "Projetos"), pipeline HTTP real com repositorios em memoria: lista, upload (tipos, nome, limite, etapa,
/// limpeza do R2), edicao de metadados, exclusao e auditoria. Padrao: 404 -> 403 -> corpo 400 (cliente nunca escreve).
/// A corrida real do limite (FOR NO KEY UPDATE) so existe com Postgres: aqui ela e simulada no fake.
/// </summary>
public sealed class ProjetoAdminTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ProjetoAdminTests(ApiFactory factory) => _factory = factory;

    private sealed class CapturingStorageService : IStorageService
    {
        public List<string> Uploads { get; } = [];
        public List<string> Downloads { get; } = [];
        public List<string> Deletes { get; } = [];
        public bool FalharAoApagar { get; set; }

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

        public Task DeleteAsync(string key)
        {
            if (FalharAoApagar)
            {
                throw new InvalidOperationException("R2 indisponivel");
            }

            Deletes.Add(key);
            return Task.CompletedTask;
        }
    }

    /// <summary>Auditoria que sempre falha (simula banco fora do ar na hora de registrar).</summary>
    private sealed class AuditoriaQueFalha : ILogAuditoriaRepository
    {
        public Task<LogAuditoria> CreateAsync(LogAuditoria log) => throw new InvalidOperationException("auditoria indisponivel");

        public Task<IReadOnlyList<LogAuditoria>> GetByEntidadeAsync(string entidade, Guid entidadeId) =>
            Task.FromResult<IReadOnlyList<LogAuditoria>>([]);
    }

    private sealed record Cenario(
        HttpClient Client,
        FakeProjetoDocumentoRepository Documentos,
        FakeEtapaRepository Etapas,
        FakeLogAuditoriaRepository Logs,
        CapturingStorageService Storage,
        Guid ObraId,
        Guid OutraObraId,
        Guid ObraVaziaId,
        Guid ClienteId,
        Guid OutroClienteId,
        Guid EtapaId,
        Guid EtapaDaOutraObraId,
        Guid Doc1Id,
        Guid Doc2Id,
        Guid DocDaOutraObraId);

    private static Etapa NovaEtapa(Guid id, Guid obraId, string nome, int ordem) => new()
    {
        Id = id,
        ObraId = obraId,
        Nome = nome,
        Ordem = ordem,
        PercentualPeso = 25m,
        Status = "nao_iniciada",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static ProjetoDocumento NovoDocumento(Guid obraId, string nome, string extensao, Guid? etapaId = null, string? tipo = null, int minutosAtras = 0) => new()
    {
        Id = Guid.NewGuid(),
        ObraId = obraId,
        EtapaId = etapaId,
        Nome = nome,
        StorageKey = $"obras/{obraId}/projetos/{Guid.NewGuid()}{extensao}",
        TipoDocumento = tipo,
        UploadedAt = DateTime.UtcNow.AddMinutes(-minutosAtras)
    };

    private async Task<Cenario> CriarCenarioAsync()
    {
        var documentos = new FakeProjetoDocumentoRepository();
        var etapas = new FakeEtapaRepository();
        var vinculos = new FakeUserObraRepository();
        var logs = new FakeLogAuditoriaRepository();
        var storage = new CapturingStorageService();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var obraVaziaId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();
        var etapaId = Guid.NewGuid();
        var etapaOutraId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await vinculos.LinkAsync(outroClienteId, outraObraId);
        await etapas.CreateAsync(NovaEtapa(etapaId, obraId, "Fundacao", 1));
        await etapas.CreateAsync(NovaEtapa(etapaOutraId, outraObraId, "Alheia", 1));
        documentos.RegistrarObra(obraVaziaId);

        var doc1 = NovoDocumento(obraId, "planta-baixa.pdf", ".pdf", etapaId, "planta", minutosAtras: 0);
        var doc2 = NovoDocumento(obraId, "memorial.docx", ".docx", minutosAtras: 60);
        var docOutra = NovoDocumento(outraObraId, "alheio.pdf", ".pdf", etapaOutraId);
        await documentos.CreateAsync(doc1);
        await documentos.CreateAsync(doc2);
        await documentos.CreateAsync(docOutra);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IProjetoDocumentoRepository>(documentos);
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
                services.AddSingleton<IStorageService>(storage);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(
            client, documentos, etapas, logs, storage, obraId, outraObraId, obraVaziaId, clienteId, outroClienteId,
            etapaId, etapaOutraId, doc1.Id, doc2.Id, docOutra.Id);
    }

    private static ProjetoDocumentoService NovoService(Cenario c, ILogAuditoriaRepository? logs = null) =>
        new(c.Documentos, c.Etapas, c.Storage, new LogAuditoriaService(logs ?? c.Logs));

    private static async Task<HttpResponseMessage> SendAsync(
        Cenario c, HttpMethod method, string url, UserRole? role, Guid? userId = null, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
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

    private static async Task<HttpResponseMessage> UploadAsync(
        Cenario c, Guid obraId, UserRole? role, Guid? userId = null, string fileName = "Planta.pdf",
        string contentType = "application/pdf", byte[]? bytes = null, string query = "")
    {
        using var body = new MultipartFormDataContent();
        var arquivo = new ByteArrayContent(bytes ?? "%PDF-1.4 conteudo"u8.ToArray());
        arquivo.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        body.Add(arquivo, "file", fileName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/obras/{obraId}/projetos{query}") { Content = body };
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static void NaoVazaChaveDoBucket(string texto)
    {
        Assert.DoesNotContain("storageKey", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("storage_key", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("obras/", texto, StringComparison.OrdinalIgnoreCase);
    }

    private static readonly byte[] DocxBytes = [0x50, 0x4B, 0x03, 0x04, 0x00, 0x00];
    private const string DocxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    // ===== Lista =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Lista_admin_traz_so_os_documentos_da_obra_com_o_dto_reduzido(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/projetos", role);
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { c.Doc1Id, c.Doc2Id }, json.EnumerateArray().Select(d => d.GetProperty("id").GetGuid()).ToArray());
        Assert.Equal(
            new[] { "etapaId", "id", "nome", "obraId", "tipoDocumento", "uploadedAt" },
            json[0].EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
        Assert.DoesNotContain(c.DocDaOutraObraId.ToString(), texto);
        NaoVazaChaveDoBucket(texto);
    }

    [Fact]
    public async Task Lista_do_cliente_da_obra_usa_o_mesmo_dto_sem_chave_e_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/projetos", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/projetos", UserRole.Client, c.OutroClienteId);
        var texto = await daObra.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(
            new[] { "etapaId", "id", "nome", "obraId", "tipoDocumento", "uploadedAt" },
            JsonDocument.Parse(texto).RootElement[0].EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
        NaoVazaChaveDoBucket(texto);
    }

    // ===== POST /obras/{obraId}/projetos =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Upload_cria_documento_com_chave_sem_nome_original_e_audita_so_ids(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        using var response = await UploadAsync(
            c, c.ObraId, role, atorId, fileName: "Planta Secreta.PDF", query: $"?etapaId={c.EtapaId}&tipoDocumento=%20Planta%20baixa%20");
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal($"/projetos/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal(c.ObraId, json.GetProperty("obraId").GetGuid());
        Assert.Equal(c.EtapaId, json.GetProperty("etapaId").GetGuid());
        Assert.Equal("Planta Secreta.PDF", json.GetProperty("nome").GetString());
        Assert.Equal("Planta baixa", json.GetProperty("tipoDocumento").GetString());
        NaoVazaChaveDoBucket(texto);

        var chave = Assert.Single(c.Storage.Uploads);
        Assert.StartsWith($"obras/{c.ObraId}/projetos/", chave);
        Assert.EndsWith(".pdf", chave);
        Assert.DoesNotContain("Secreta", chave, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(chave, c.Documentos.Inspecionar(id)!.StorageKey);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("projeto_enviado", log.Acao);
        Assert.Equal("projeto_documento", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains($"\"obraId\":\"{c.ObraId}\"", log.Detalhes);
        Assert.DoesNotContain("Secreta", log.Detalhes);
        Assert.DoesNotContain("Planta", log.Detalhes);
    }

    [Fact]
    public async Task Upload_sem_etapa_e_sem_tipo_grava_nulos()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("etapaId").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("tipoDocumento").ValueKind);
    }

    [Fact]
    public async Task Upload_aceita_docx_e_imagem()
    {
        var c = await CriarCenarioAsync();

        using var docx = await UploadAsync(c, c.ObraId, UserRole.Admin, fileName: "Memorial.docx", contentType: DocxMime, bytes: DocxBytes);
        using var png = await UploadAsync(
            c, c.ObraId, UserRole.Admin, fileName: "Foto.png", contentType: "image/png",
            bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);

        Assert.Equal(HttpStatusCode.Created, docx.StatusCode);
        Assert.Equal(HttpStatusCode.Created, png.StatusCode);
        Assert.Equal(2, c.Storage.Uploads.Count);
    }

    [Fact]
    public async Task Upload_do_cliente_recebe_403_mesmo_com_arquivo_invalido_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Documentos.Total;

        using var valido = await UploadAsync(c, c.ObraId, UserRole.Client, c.ClienteId);
        using var semAssinatura = await UploadAsync(c, c.ObraId, UserRole.Client, c.ClienteId, bytes: [0x00, 0x01, 0x02, 0x03]);
        using var extensaoProibida = await UploadAsync(c, c.ObraId, UserRole.Client, c.ClienteId, fileName: "virus.exe");
        using var nomeLongo = await UploadAsync(c, c.ObraId, UserRole.Client, c.ClienteId, fileName: new string('a', 300) + ".pdf");
        using var deOutra = await UploadAsync(c, c.ObraId, UserRole.Client, c.OutroClienteId);

        foreach (var resposta in new[] { valido, semAssinatura, extensaoProibida, nomeLongo, deOutra })
        {
            Assert.Equal(HttpStatusCode.Forbidden, resposta.StatusCode);
        }

        Assert.Empty(c.Storage.Uploads);
        Assert.Equal(antes, c.Documentos.Total);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Upload_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_em_obra_inexistente_retorna_404_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, Guid.NewGuid(), UserRole.Admin);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Upload_admin_nao_depende_de_vinculo_com_a_obra()
    {
        var c = await CriarCenarioAsync();

        // Admin sem vinculo em user_obra envia para qualquer obra existente (a regra e a do ObraAccessService).
        using var response = await UploadAsync(c, c.OutraObraId, UserRole.Admin, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Upload_com_etapa_de_outra_obra_ou_inexistente_retorna_o_mesmo_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();

        using var deOutra = await UploadAsync(c, c.ObraId, UserRole.Admin, query: $"?etapaId={c.EtapaDaOutraObraId}");
        using var inexistente = await UploadAsync(c, c.ObraId, UserRole.Admin, query: $"?etapaId={Guid.NewGuid()}");
        var errosOutra = (await JsonAsync(deOutra)).GetProperty("errors").GetRawText();
        var errosInexistente = (await JsonAsync(inexistente)).GetProperty("errors").GetRawText();

        Assert.Equal(HttpStatusCode.BadRequest, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inexistente.StatusCode);
        Assert.Equal(errosOutra, errosInexistente);
        Assert.Contains("EtapaId", errosOutra);
        Assert.DoesNotContain(c.EtapaDaOutraObraId.ToString(), errosOutra);
        Assert.Empty(c.Storage.Uploads);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Upload_com_nome_de_arquivo_maior_que_255_retorna_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Documentos.Total;

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin, fileName: new string('a', 252) + ".pdf"); // 256
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("255", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
        Assert.Equal(antes, c.Documentos.Total);
    }

    [Fact]
    public async Task Upload_com_nome_de_exatamente_255_caracteres_e_aceito()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin, fileName: new string('a', 251) + ".pdf"); // 255

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(c.Storage.Uploads);
    }

    [Fact]
    public async Task Service_recusa_nome_com_barras_ou_controle_antes_do_storage()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        using var conteudo = new MemoryStream("%PDF"u8.ToArray());

        foreach (var nome in new[] { "../segredo.pdf", "a\\b.pdf", "a\nb.pdf", "" })
        {
            var resultado = await service.UploadAsync(c.ObraId, null, conteudo, nome, "application/pdf", null, Guid.NewGuid());

            Assert.Equal(ProjetoUploadStatus.NomeArquivoInvalido, resultado.Status);
        }

        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_com_tipo_documento_maior_que_50_retorna_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();

        using var estourou = await UploadAsync(c, c.ObraId, UserRole.Admin, query: $"?tipoDocumento={new string('t', 51)}");
        using var noLimite = await UploadAsync(c, c.ObraId, UserRole.Admin, query: $"?tipoDocumento={new string('t', 50)}");

        Assert.Equal(HttpStatusCode.BadRequest, estourou.StatusCode);
        Assert.Contains("50", (await JsonAsync(estourou)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.Created, noLimite.StatusCode);
        Assert.Single(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_de_txt_passa_no_validador_generico_mas_nao_e_projeto_e_retorna_400()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin, fileName: "notas.txt", contentType: "text/plain", bytes: "ola"u8.ToArray());
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("PDF", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_com_conteudo_que_nao_bate_com_o_tipo_retorna_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin, bytes: [0x4D, 0x5A, 0x90, 0x00]);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_ate_o_limite_de_200_documentos_e_recusa_o_201o_com_400()
    {
        var c = await CriarCenarioAsync();
        for (var i = 0; i < ProjetoRegras.MaxDocumentosPorObra - 2; i++)
        {
            await c.Documentos.CreateAsync(NovoDocumento(c.ObraId, $"doc-{i}.pdf", ".pdf"));
        }

        using var excedeu = await UploadAsync(c, c.ObraId, UserRole.Admin);
        var json = await JsonAsync(excedeu);

        Assert.Equal(HttpStatusCode.BadRequest, excedeu.StatusCode);
        Assert.Contains("200", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Upload_aceita_o_200o_documento()
    {
        var c = await CriarCenarioAsync();
        for (var i = 0; i < ProjetoRegras.MaxDocumentosPorObra - 3; i++)
        {
            await c.Documentos.CreateAsync(NovoDocumento(c.ObraId, $"doc-{i}.pdf", ".pdf"));
        }

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Limite_e_por_obra_e_nao_global()
    {
        var c = await CriarCenarioAsync();
        for (var i = 0; i < ProjetoRegras.MaxDocumentosPorObra; i++)
        {
            await c.Documentos.CreateAsync(NovoDocumento(c.OutraObraId, $"doc-{i}.pdf", ".pdf"));
        }

        using var response = await UploadAsync(c, c.ObraId, UserRole.Admin);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Service_remove_o_objeto_do_storage_se_o_banco_falhar_depois_do_upload()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        c.Documentos.FalharAoAdicionar = true;
        var antes = c.Documentos.Total;
        using var conteudo = new MemoryStream("%PDF"u8.ToArray());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UploadAsync(c.ObraId, null, conteudo, "x.pdf", "application/pdf", null, Guid.NewGuid()));

        var chave = Assert.Single(c.Storage.Uploads);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.Equal(antes, c.Documentos.Total);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Service_apaga_o_objeto_se_o_limite_estourar_na_corrida_entre_a_checagem_e_o_insert()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        c.Documentos.EstourarLimiteNaCorrida = true;
        using var conteudo = new MemoryStream("%PDF"u8.ToArray());

        var resultado = await service.UploadAsync(c.ObraId, null, conteudo, "x.pdf", "application/pdf", null, Guid.NewGuid());

        Assert.Equal(ProjetoUploadStatus.LimiteExcedido, resultado.Status);
        var chave = Assert.Single(c.Storage.Uploads);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Service_nao_sobe_documento_em_obra_inexistente()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        using var conteudo = new MemoryStream("%PDF"u8.ToArray());

        var resultado = await service.UploadAsync(Guid.NewGuid(), null, conteudo, "x.pdf", "application/pdf", null, Guid.NewGuid());

        Assert.Equal(ProjetoUploadStatus.ObraNaoEncontrada, resultado.Status);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Service_nao_aceita_etapa_de_outra_obra_no_upload()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        using var conteudo = new MemoryStream("%PDF"u8.ToArray());

        var resultado = await service.UploadAsync(c.ObraVaziaId, c.EtapaId, conteudo, "x.pdf", "application/pdf", null, Guid.NewGuid());

        Assert.Equal(ProjetoUploadStatus.EtapaInvalida, resultado.Status);
        Assert.Empty(c.Storage.Uploads);
    }

    // ===== PUT /projetos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Put_edita_nome_tipo_e_etapa_e_audita_so_nomes_de_campos(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        // O JSON traz um obraId de outra obra: precisa ser ignorado.
        using var response = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc2Id}", role, atorId,
            new { obraId = c.OutraObraId, nome = "Memorial descritivo.docx", tipoDocumento = "  Memorial  ", etapaId = c.EtapaId });
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(c.ObraId, json.GetProperty("obraId").GetGuid());
        Assert.Equal("Memorial descritivo.docx", json.GetProperty("nome").GetString());
        Assert.Equal("Memorial", json.GetProperty("tipoDocumento").GetString());
        Assert.Equal(c.EtapaId, json.GetProperty("etapaId").GetGuid());
        NaoVazaChaveDoBucket(texto);

        var salvo = c.Documentos.Inspecionar(c.Doc2Id)!;
        Assert.Equal(c.ObraId, salvo.ObraId);
        Assert.EndsWith(".docx", salvo.StorageKey); // o arquivo nao muda

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("projeto_editado", log.Acao);
        Assert.Equal("projeto_documento", log.Entidade);
        Assert.Equal(c.Doc2Id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"campos\":[\"nome\",\"tipoDocumento\",\"etapaId\"]", log.Detalhes);
        Assert.DoesNotContain("Memorial", log.Detalhes);
    }

    [Fact]
    public async Task Put_com_null_limpa_tipo_e_etapa()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin,
            body: new { nome = "planta-baixa.pdf", tipoDocumento = (string?)null, etapaId = (Guid?)null });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var salvo = c.Documentos.Inspecionar(c.Doc1Id)!;
        Assert.Null(salvo.TipoDocumento);
        Assert.Null(salvo.EtapaId);
        Assert.Contains("\"campos\":[\"tipoDocumento\",\"etapaId\"]", Assert.Single(c.Logs.Logs).Detalhes);
    }

    [Fact]
    public async Task Put_sem_nenhuma_mudanca_responde_200_e_nao_audita()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin,
            body: new { nome = "planta-baixa.pdf", tipoDocumento = "planta", etapaId = c.EtapaId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Theory]
    [InlineData("Planta Nova.PDF")]
    [InlineData("v2.pdf")]
    public async Task Put_aceita_nome_com_a_mesma_extensao_em_qualquer_caixa(string nome)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin, body: new { nome, tipoDocumento = "planta", etapaId = c.EtapaId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(nome, c.Documentos.Inspecionar(c.Doc1Id)!.Nome);
    }

    [Theory]
    [InlineData("planta.docx")]
    [InlineData("planta")]
    [InlineData("planta.pdf.exe")]
    [InlineData("planta.html")]
    public async Task Put_com_nome_que_muda_a_extensao_retorna_400_em_nome_e_nada_muda(string nome)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin, body: new { nome, tipoDocumento = "planta", etapaId = c.EtapaId });
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(json.GetProperty("errors").TryGetProperty("Nome", out _));
        Assert.Equal("planta-baixa.pdf", c.Documentos.Inspecionar(c.Doc1Id)!.Nome);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_com_etapa_de_outra_obra_ou_inexistente_retorna_o_mesmo_400_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var deOutra = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin,
            body: new { nome = "invasao.pdf", tipoDocumento = "x", etapaId = c.EtapaDaOutraObraId });
        using var inexistente = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin,
            body: new { nome = "invasao.pdf", tipoDocumento = "x", etapaId = Guid.NewGuid() });
        var errosOutra = (await JsonAsync(deOutra)).GetProperty("errors").GetRawText();
        var errosInexistente = (await JsonAsync(inexistente)).GetProperty("errors").GetRawText();

        Assert.Equal(HttpStatusCode.BadRequest, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inexistente.StatusCode);
        Assert.Equal(errosOutra, errosInexistente);
        Assert.Contains("EtapaId", errosOutra);
        Assert.DoesNotContain(c.EtapaDaOutraObraId.ToString(), errosOutra);
        var salvo = c.Documentos.Inspecionar(c.Doc1Id)!;
        Assert.Equal("planta-baixa.pdf", salvo.Nome);
        Assert.Equal(c.EtapaId, salvo.EtapaId);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_com_corpo_invalido_retorna_400_com_errors_e_nada_muda()
    {
        var c = await CriarCenarioAsync();
        var corpos = new object[]
        {
            new { nome = "", tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = "   ", tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = (string?)null, tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = new string('a', 252) + ".pdf", tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = "a/b.pdf", tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = "a\\b.pdf", tipoDocumento = "x", etapaId = (Guid?)null },
            new { nome = "ok.pdf", tipoDocumento = new string('t', 51), etapaId = (Guid?)null }
        };

        foreach (var corpo in corpos)
        {
            using var response = await SendAsync(c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin, body: corpo);
            var json = await JsonAsync(response);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        }

        var salvo = c.Documentos.Inspecionar(c.Doc1Id)!;
        Assert.Equal("planta-baixa.pdf", salvo.Nome);
        Assert.Equal("planta", salvo.TipoDocumento);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_do_cliente_recebe_403_antes_de_validar_o_corpo_e_nada_muda()
    {
        var c = await CriarCenarioAsync();
        var valido = new { nome = "hack.pdf", tipoDocumento = "x", etapaId = (Guid?)null };
        var invalido = new { nome = "", tipoDocumento = new string('t', 99), etapaId = (Guid?)null };

        using var daObra = await SendAsync(c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Client, c.ClienteId, valido);
        using var daObraInvalido = await SendAsync(c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Client, c.ClienteId, invalido);
        using var deOutra = await SendAsync(c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Client, c.OutroClienteId, valido);
        var corpoDoErro = await deOutra.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, daObraInvalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.DoesNotContain("planta-baixa", corpoDoErro);
        Assert.Equal("planta-baixa.pdf", c.Documentos.Inspecionar(c.Doc1Id)!.Nome);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_anonimo_401_e_inexistente_404_mesmo_com_corpo_invalido()
    {
        var c = await CriarCenarioAsync();
        var invalido = new { nome = "", tipoDocumento = (string?)null, etapaId = (Guid?)null };

        using var anonimo = await SendAsync(c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", null, body: invalido);
        using var inexistente = await SendAsync(c, HttpMethod.Put, $"/projetos/{Guid.NewGuid()}", UserRole.Admin, body: invalido);

        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
    }

    [Fact]
    public async Task Service_nao_edita_nem_exclui_documento_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var edicao = await service.UpdateAsync(
            c.Doc1Id, c.OutraObraId, new UpdateProjetoDocumentoRequest("invasao.pdf", "x", null), Guid.NewGuid());
        var exclusao = await service.DeleteAsync(c.Doc1Id, c.OutraObraId, Guid.NewGuid());
        var download = await service.DownloadAsync(c.Doc1Id, c.OutraObraId);

        Assert.Equal(ProjetoUpdateStatus.NaoEncontrado, edicao.Status);
        Assert.Null(exclusao);
        Assert.Null(download);
        Assert.Equal("planta-baixa.pdf", c.Documentos.Inspecionar(c.Doc1Id)!.Nome);
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Storage.Downloads);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== DELETE /projetos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Delete_remove_do_banco_e_do_storage_audita_e_nao_toca_nos_vizinhos(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var chave = c.Documentos.Inspecionar(c.Doc1Id)!.StorageKey;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/projetos/{c.Doc1Id}", role, atorId);
        using var download = await SendAsync(c, HttpMethod.Get, $"/projetos/{c.Doc1Id}/download", role);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
        Assert.Null(c.Documentos.Inspecionar(c.Doc1Id));
        Assert.NotNull(c.Documentos.Inspecionar(c.Doc2Id));
        Assert.NotNull(c.Documentos.Inspecionar(c.DocDaOutraObraId));
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("projeto_excluido", log.Acao);
        Assert.Equal("projeto_documento", log.Entidade);
        Assert.Equal(c.Doc1Id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains($"\"obraId\":\"{c.ObraId}\"", log.Detalhes);
        Assert.DoesNotContain("planta", log.Detalhes);
    }

    [Fact]
    public async Task Delete_responde_204_mesmo_se_o_storage_falhar()
    {
        var c = await CriarCenarioAsync();
        c.Storage.FalharAoApagar = true;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/projetos/{c.Doc1Id}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(c.Documentos.Inspecionar(c.Doc1Id));
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_ainda_apaga_o_arquivo_do_storage_se_a_auditoria_falhar()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c, new AuditoriaQueFalha());
        var chave = c.Documentos.Inspecionar(c.Doc1Id)!.StorageKey;

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DeleteAsync(c.Doc1Id, c.ObraId, Guid.NewGuid()));

        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.Null(c.Documentos.Inspecionar(c.Doc1Id));
    }

    [Fact]
    public async Task Delete_do_cliente_403_anonimo_401_inexistente_404_e_nada_e_apagado()
    {
        var c = await CriarCenarioAsync();

        using var cliente = await SendAsync(c, HttpMethod.Delete, $"/projetos/{c.Doc1Id}", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Delete, $"/projetos/{c.Doc1Id}", UserRole.Client, c.OutroClienteId);
        using var anonimo = await SendAsync(c, HttpMethod.Delete, $"/projetos/{c.Doc1Id}", null);
        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/projetos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.Forbidden, cliente.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.NotNull(c.Documentos.Inspecionar(c.Doc1Id));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== Download =====

    [Fact]
    public async Task Download_apos_renomear_usa_o_nome_novo_e_o_tipo_vem_da_chave()
    {
        var c = await CriarCenarioAsync();
        using var edicao = await SendAsync(
            c, HttpMethod.Put, $"/projetos/{c.Doc1Id}", UserRole.Admin,
            body: new { nome = "Planta revisada.pdf", tipoDocumento = "planta", etapaId = c.EtapaId });

        using var response = await SendAsync(c, HttpMethod.Get, $"/projetos/{c.Doc1Id}/download", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("nosniff", response.Headers.GetValues("X-Content-Type-Options"));
        Assert.Equal("Planta revisada.pdf", response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
    }

    [Fact]
    public async Task Download_usa_nome_sintetico_se_o_nome_gravado_tem_extensao_diferente_da_do_arquivo()
    {
        var c = await CriarCenarioAsync();
        var legado = NovoDocumento(c.ObraId, "pagina.html", ".pdf");
        await c.Documentos.CreateAsync(legado);
        var service = NovoService(c);

        var resultado = await service.DownloadAsync(legado.Id, c.ObraId);

        Assert.Equal($"projeto-{legado.Id}.pdf", resultado!.Value.FileName);
        Assert.Equal("application/pdf", resultado.Value.ContentType);
    }
}
