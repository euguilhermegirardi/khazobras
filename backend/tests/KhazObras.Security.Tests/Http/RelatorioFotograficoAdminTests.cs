using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
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
/// Relatorio fotografico admin (tela "Relatorio fotografico"), pipeline HTTP real com repositorios em memoria:
/// lista/detalhe, criar/editar/excluir relatorio, upload (limite, nome, metadados, limpeza do R2), PATCH/DELETE de foto,
/// reordenacao em lote e auditoria. Padrao de acesso: 404 -> 403 -> corpo 400 (cliente nunca escreve).
/// </summary>
public sealed class RelatorioFotograficoAdminTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public RelatorioFotograficoAdminTests(ApiFactory factory) => _factory = factory;

    private sealed class CapturingStorageService : IStorageService
    {
        public List<string> Uploads { get; } = [];
        public List<string> Deletes { get; } = [];
        public bool FalharAoApagar { get; set; }

        public Task<string> UploadAsync(string key, Stream content, string contentType)
        {
            Uploads.Add(key);
            return Task.FromResult(key);
        }

        public Task<Stream> DownloadAsync(string key) => Task.FromResult<Stream>(new MemoryStream());

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

    private sealed record Cenario(
        HttpClient Client,
        FakeRelatorioFotograficoRepository Relatorios,
        FakeLogAuditoriaRepository Logs,
        CapturingStorageService Storage,
        Guid ObraId,
        Guid OutraObraId,
        Guid ClienteId,
        Guid OutroClienteId,
        Guid EtapaId,
        Guid EtapaDaOutraObraId,
        Guid RelatorioId,
        Guid Foto1Id,
        Guid Foto2Id,
        Guid RelatorioDaOutraObraId,
        Guid FotoDaOutraObraId);

    private static Foto NovaFoto(Guid obraId, Guid relatorioId, int ordem, string? descricao, DateOnly? data = null) => new()
    {
        Id = Guid.NewGuid(),
        RelatorioFotograficoId = relatorioId,
        StorageKey = $"obras/{obraId}/relatorios-fotograficos/{relatorioId}/{Guid.NewGuid()}.jpg",
        DataFoto = data,
        Descricao = descricao,
        Ordem = ordem,
        CreatedAt = DateTime.UtcNow
    };

    private async Task<Cenario> CriarCenarioAsync()
    {
        var relatorios = new FakeRelatorioFotograficoRepository();
        var vinculos = new FakeUserObraRepository();
        var obras = new FakeObraRepository();
        var etapas = new FakeEtapaRepository();
        var logs = new FakeLogAuditoriaRepository();
        var storage = new CapturingStorageService();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();
        var etapaId = Guid.NewGuid();
        var etapaOutraId = Guid.NewGuid();
        var relatorioId = Guid.NewGuid();
        var relatorioOutraId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await vinculos.LinkAsync(outroClienteId, outraObraId);
        await obras.CreateAsync(new Obra { Id = obraId, Nome = "Obra A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await obras.CreateAsync(new Obra { Id = outraObraId, Nome = "Obra B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await etapas.CreateAsync(new Etapa { Id = etapaId, ObraId = obraId, Nome = "Fundacao", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await etapas.CreateAsync(new Etapa { Id = etapaOutraId, ObraId = outraObraId, Nome = "Alheia", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        await relatorios.CreateAsync(new RelatorioFotografico
        {
            Id = relatorioId,
            ObraId = obraId,
            Tipo = "mensal",
            Titulo = "Setembro",
            Competencia = new DateOnly(2026, 9, 1),
            CreatedAt = DateTime.UtcNow
        });
        // Inseridas fora de ordem de proposito: a leitura precisa devolver por ordem (Fundacao = 0, Fachada = 1).
        var foto1 = NovaFoto(obraId, relatorioId, 1, "Fachada", new DateOnly(2026, 9, 10));
        var foto2 = NovaFoto(obraId, relatorioId, 0, "Fundacao", new DateOnly(2026, 9, 5));
        await relatorios.AddFotoAsync(foto1);
        await relatorios.AddFotoAsync(foto2);

        await relatorios.CreateAsync(new RelatorioFotografico
        {
            Id = relatorioOutraId,
            ObraId = outraObraId,
            Tipo = "mensal",
            Titulo = "Alheio",
            CreatedAt = DateTime.UtcNow
        });
        var fotoOutra = NovaFoto(outraObraId, relatorioOutraId, 0, "Alheia");
        await relatorios.AddFotoAsync(fotoOutra);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IRelatorioFotograficoRepository>(relatorios);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IObraRepository>(obras);
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
                services.AddSingleton<IStorageService>(storage);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(
            client, relatorios, logs, storage, obraId, outraObraId, clienteId, outroClienteId, etapaId, etapaOutraId,
            relatorioId, foto1.Id, foto2.Id, relatorioOutraId, fotoOutra.Id);
    }

    private static async Task<HttpResponseMessage> SendAsync(
        Cenario c, HttpMethod method, string url, UserRole? role, Guid? userId = null, object? body = null)
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

    private static async Task<HttpResponseMessage> UploadAsync(
        Cenario c, Guid relatorioId, UserRole? role, Guid? userId = null, string fileName = "foto.png", string query = "")
    {
        using var body = new MultipartFormDataContent();
        var png = new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        body.Add(png, "file", fileName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/relatorios-fotograficos/{relatorioId}/fotos{query}") { Content = body };
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static object CorpoRelatorio(
        Guid? obraId = null, string tipo = "mensal", Guid? etapaId = null, string titulo = "Outubro", string? competencia = "2026-10-01") =>
        new { obraId, tipo, etapaId, titulo, competencia };

    private static RelatorioFotograficoService NovoService(Cenario c) => new(
        c.Relatorios, c.Storage, new FakeEtapaRepository(), new FakeObraRepository(), new LogAuditoriaService(c.Logs));

    private static string DataDaqui(int dias) => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(dias).ToString("yyyy-MM-dd");

    private static void NaoVazaChaveDoBucket(string texto)
    {
        Assert.DoesNotContain("storageKey", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("storage_key", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("relatorios-fotograficos/", texto, StringComparison.OrdinalIgnoreCase);
    }

    // ===== Lista e detalhe =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Lista_admin_traz_contagem_fotos_em_ordem_estavel_sem_chave_do_bucket(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-fotograficos", role);
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var relatorio = Assert.Single(json.EnumerateArray());
        Assert.Equal(c.RelatorioId, relatorio.GetProperty("id").GetGuid());
        Assert.Equal(c.ObraId, relatorio.GetProperty("obraId").GetGuid());
        Assert.Equal("mensal", relatorio.GetProperty("tipo").GetString());
        Assert.Equal("Setembro", relatorio.GetProperty("titulo").GetString());
        Assert.Equal("2026-09-01", relatorio.GetProperty("competencia").GetString());
        Assert.Equal(2, relatorio.GetProperty("quantidadeFotos").GetInt32());

        var fotos = relatorio.GetProperty("fotos");
        Assert.Equal(new[] { c.Foto2Id, c.Foto1Id }, fotos.EnumerateArray().Select(f => f.GetProperty("id").GetGuid()).ToArray());
        Assert.Equal("Fundacao", fotos[0].GetProperty("descricao").GetString());
        Assert.Equal("2026-09-05", fotos[0].GetProperty("dataFoto").GetString());
        Assert.Equal(0, fotos[0].GetProperty("ordem").GetInt32());
        Assert.True(fotos[0].TryGetProperty("createdAt", out _));
        NaoVazaChaveDoBucket(texto);
    }

    [Fact]
    public async Task Lista_nao_mistura_relatorios_de_outra_obra()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-fotograficos", UserRole.Admin);
        var texto = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain(c.RelatorioDaOutraObraId.ToString(), texto);
        Assert.DoesNotContain(c.FotoDaOutraObraId.ToString(), texto);
    }

    [Fact]
    public async Task Lista_do_cliente_da_obra_usa_o_mesmo_dto_sem_chave_do_bucket_e_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-fotograficos", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-fotograficos", UserRole.Client, c.OutroClienteId);
        var texto = await daObra.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(2, JsonDocument.Parse(texto).RootElement[0].GetProperty("quantidadeFotos").GetInt32());
        NaoVazaChaveDoBucket(texto);
    }

    [Fact]
    public async Task Detalhe_segue_o_padrao_404_403_200_e_nao_vaza_a_chave()
    {
        var c = await CriarCenarioAsync();

        using var admin = await SendAsync(c, HttpMethod.Get, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Admin);
        using var cliente = await SendAsync(c, HttpMethod.Get, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Get, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.OutroClienteId);
        using var inexistente = await SendAsync(c, HttpMethod.Get, $"/relatorios-fotograficos/{Guid.NewGuid()}", UserRole.Admin);
        using var anonimo = await SendAsync(c, HttpMethod.Get, $"/relatorios-fotograficos/{c.RelatorioId}", null);

        Assert.Equal(HttpStatusCode.OK, admin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, cliente.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        var texto = await admin.Content.ReadAsStringAsync();
        Assert.Equal(2, JsonDocument.Parse(texto).RootElement.GetProperty("fotos").GetArrayLength());
        NaoVazaChaveDoBucket(texto);
    }

    [Fact]
    public async Task Service_nao_devolve_relatorio_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        Assert.NotNull(await service.GetByIdAndObraAsync(c.RelatorioId, c.ObraId));
        Assert.Null(await service.GetByIdAndObraAsync(c.RelatorioId, c.OutraObraId));
    }

    // ===== POST /relatorios-fotograficos =====

    [Fact]
    public async Task Admin_cria_relatorio_mensal_e_a_resposta_vem_sem_fotos()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin, body: CorpoRelatorio(c.ObraId, tipo: "MENSAL", titulo: "  Outubro  "));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal($"/relatorios-fotograficos/{json.GetProperty("id").GetGuid()}", response.Headers.Location?.OriginalString);
        Assert.Equal("mensal", json.GetProperty("tipo").GetString());
        Assert.Equal("Outubro", json.GetProperty("titulo").GetString());
        Assert.Equal("2026-10-01", json.GetProperty("competencia").GetString());
        Assert.Equal(0, json.GetProperty("quantidadeFotos").GetInt32());
        Assert.Empty(json.GetProperty("fotos").EnumerateArray());
    }

    [Fact]
    public async Task Admin_cria_relatorio_de_etapa_com_etapa_da_mesma_obra()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin,
            body: CorpoRelatorio(c.ObraId, tipo: "etapa", etapaId: c.EtapaId, competencia: null));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(c.EtapaId, json.GetProperty("etapaId").GetGuid());
    }

    [Fact]
    public async Task Criar_com_etapa_de_outra_obra_ou_inexistente_retorna_o_mesmo_400_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Relatorios.TotalRelatorios;

        using var deOutra = await SendAsync(
            c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin, body: CorpoRelatorio(c.ObraId, tipo: "etapa", etapaId: c.EtapaDaOutraObraId));
        using var inexistente = await SendAsync(
            c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin, body: CorpoRelatorio(c.ObraId, tipo: "etapa", etapaId: Guid.NewGuid()));
        var errosOutra = (await JsonAsync(deOutra)).GetProperty("errors").GetRawText();
        var errosInexistente = (await JsonAsync(inexistente)).GetProperty("errors").GetRawText();

        Assert.Equal(HttpStatusCode.BadRequest, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inexistente.StatusCode);
        Assert.Equal(errosOutra, errosInexistente);
        Assert.Contains("EtapaId", errosOutra);
        Assert.DoesNotContain(c.EtapaDaOutraObraId.ToString(), errosOutra);
        Assert.Equal(antes, c.Relatorios.TotalRelatorios);
    }

    [Fact]
    public async Task Criar_em_obra_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Relatorios.TotalRelatorios;

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin, body: CorpoRelatorio(Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(antes, c.Relatorios.TotalRelatorios);
    }

    [Fact]
    public async Task Cliente_nao_cria_relatorio_nem_com_corpo_invalido_e_recebe_403()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Relatorios.TotalRelatorios;

        using var valido = await SendAsync(c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Client, c.ClienteId, CorpoRelatorio(c.ObraId));
        using var invalido = await SendAsync(c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Client, c.ClienteId, CorpoRelatorio(c.ObraId, titulo: ""));
        using var deOutra = await SendAsync(c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Client, c.OutroClienteId, CorpoRelatorio(c.ObraId));

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(antes, c.Relatorios.TotalRelatorios);
    }

    public static IEnumerable<object[]> CorposDeRelatorioInvalidos() =>
    [
        [CorpoRelatorio(titulo: "")],
        [CorpoRelatorio(titulo: "   ")],
        [CorpoRelatorio(titulo: new string('x', 151))],
        [CorpoRelatorio(tipo: "anual")],
        [CorpoRelatorio(competencia: "1999-12-01")]
    ];

    [Theory]
    [MemberData(nameof(CorposDeRelatorioInvalidos))]
    public async Task Criar_com_corpo_invalido_retorna_400_com_errors(object corpo)
    {
        var c = await CriarCenarioAsync();
        var json = JsonSerializer.SerializeToElement(corpo);
        var comObra = new Dictionary<string, object?>
        {
            ["obraId"] = c.ObraId,
            ["tipo"] = json.GetProperty("tipo").GetString(),
            ["etapaId"] = null,
            ["titulo"] = json.GetProperty("titulo").GetString(),
            ["competencia"] = json.GetProperty("competencia").ValueKind == JsonValueKind.Null ? null : json.GetProperty("competencia").GetString()
        };

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-fotograficos", UserRole.Admin, body: comObra);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, (await JsonAsync(response)).GetProperty("errors").ValueKind);
    }

    // ===== PUT /relatorios-fotograficos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Put_edita_metadados_audita_so_nomes_de_campos_e_nao_troca_a_obra(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        // O JSON traz um obraId de outra obra: precisa ser ignorado.
        using var response = await SendAsync(
            c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", role, atorId,
            CorpoRelatorio(c.OutraObraId, tipo: "etapa", etapaId: c.EtapaId, titulo: "Fundacao concluida", competencia: null));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(c.ObraId, json.GetProperty("obraId").GetGuid());
        Assert.Equal("etapa", json.GetProperty("tipo").GetString());
        Assert.Equal(c.EtapaId, json.GetProperty("etapaId").GetGuid());
        Assert.Equal("Fundacao concluida", json.GetProperty("titulo").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("competencia").ValueKind);
        Assert.Equal(2, json.GetProperty("quantidadeFotos").GetInt32());

        var salvo = c.Relatorios.Inspecionar(c.RelatorioId)!;
        Assert.Equal(c.ObraId, salvo.ObraId);
        Assert.Equal("Fundacao concluida", salvo.Titulo);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_fotografico_editado", log.Acao);
        Assert.Equal("relatorio_fotografico", log.Entidade);
        Assert.Equal(c.RelatorioId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"campos\":[\"tipo\",\"etapaId\",\"titulo\",\"competencia\"]", log.Detalhes);
        Assert.DoesNotContain("Fundacao", log.Detalhes);
        Assert.DoesNotContain("Setembro", log.Detalhes);
    }

    [Fact]
    public async Task Put_sem_nenhuma_mudanca_responde_200_e_nao_audita()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Admin,
            body: CorpoRelatorio(tipo: "mensal", titulo: "Setembro", competencia: "2026-09-01"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_com_etapa_de_outra_obra_retorna_400_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Admin,
            body: CorpoRelatorio(tipo: "etapa", etapaId: c.EtapaDaOutraObraId, titulo: "Invasao"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("EtapaId", await response.Content.ReadAsStringAsync());
        var salvo = c.Relatorios.Inspecionar(c.RelatorioId)!;
        Assert.Equal("Setembro", salvo.Titulo);
        Assert.Null(salvo.EtapaId);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_do_cliente_recebe_403_mesmo_com_corpo_invalido_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.ClienteId, CorpoRelatorio());
        using var invalido = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.ClienteId, CorpoRelatorio(titulo: ""));
        using var deOutra = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.OutroClienteId, CorpoRelatorio());

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal("Setembro", c.Relatorios.Inspecionar(c.RelatorioId)!.Titulo);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_anonimo_401_inexistente_404_mesmo_com_corpo_invalido_e_corpo_invalido_400()
    {
        var c = await CriarCenarioAsync();

        using var anonimo = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", null, body: CorpoRelatorio());
        using var inexistente = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{Guid.NewGuid()}", UserRole.Admin, body: CorpoRelatorio(titulo: ""));
        using var invalido = await SendAsync(c, HttpMethod.Put, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Admin, body: CorpoRelatorio(titulo: ""));

        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
    }

    [Fact]
    public async Task Service_nao_edita_nem_exclui_relatorio_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var edicao = await service.UpdateAsync(
            c.RelatorioId, c.OutraObraId, new UpdateRelatorioFotograficoRequest("mensal", null, "Invasao", null), Guid.NewGuid());
        var exclusao = await service.DeleteAsync(c.RelatorioId, c.OutraObraId, Guid.NewGuid());

        Assert.Equal(RelatorioUpdateStatus.NaoEncontrado, edicao.Status);
        Assert.Null(exclusao);
        Assert.Equal("Setembro", c.Relatorios.Inspecionar(c.RelatorioId)!.Titulo);
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== DELETE /relatorios-fotograficos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Delete_remove_o_relatorio_apaga_as_fotos_do_storage_e_audita(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var chaves = c.Relatorios.Inspecionar(c.RelatorioId)!.Fotos.Select(f => f.StorageKey).OrderBy(k => k).ToArray();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{c.RelatorioId}", role, atorId);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(c.Relatorios.Inspecionar(c.RelatorioId));
        Assert.Equal(chaves, c.Storage.Deletes.OrderBy(k => k).ToArray());
        // Nao toca no relatorio vizinho (outra obra).
        Assert.NotNull(c.Relatorios.Inspecionar(c.RelatorioDaOutraObraId));

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_fotografico_excluido", log.Acao);
        Assert.Equal(c.RelatorioId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"quantidadeFotos\":2", log.Detalhes);
        Assert.DoesNotContain("Setembro", log.Detalhes);
    }

    [Fact]
    public async Task Delete_responde_204_mesmo_se_o_storage_falhar()
    {
        var c = await CriarCenarioAsync();
        c.Storage.FalharAoApagar = true;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(c.Relatorios.Inspecionar(c.RelatorioId));
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_do_cliente_403_anonimo_401_inexistente_404_e_nada_e_apagado()
    {
        var c = await CriarCenarioAsync();

        using var cliente = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{c.RelatorioId}", UserRole.Client, c.OutroClienteId);
        using var anonimo = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{c.RelatorioId}", null);
        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/relatorios-fotograficos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.Forbidden, cliente.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.NotNull(c.Relatorios.Inspecionar(c.RelatorioId));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== POST /relatorios-fotograficos/{id}/fotos =====

    [Fact]
    public async Task Upload_sem_ordem_vai_para_o_fim_e_a_resposta_nao_traz_chave()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin, query: "?descricao=%20Viga%20&dataFoto=2026-10-01");
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal($"/fotos/{json.GetProperty("id").GetGuid()}", response.Headers.Location?.OriginalString);
        Assert.Equal(2, json.GetProperty("ordem").GetInt32()); // as existentes tem 0 e 1
        Assert.Equal("Viga", json.GetProperty("descricao").GetString());
        Assert.Equal("2026-10-01", json.GetProperty("dataFoto").GetString());
        var chave = Assert.Single(c.Storage.Uploads);
        Assert.StartsWith($"obras/{c.ObraId}/relatorios-fotograficos/{c.RelatorioId}/", chave);
        Assert.EndsWith(".png", chave);
        Assert.DoesNotContain("foto.png", chave);
        NaoVazaChaveDoBucket(texto);
    }

    [Fact]
    public async Task Upload_com_ordem_explicita_respeita_o_valor()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin, query: "?ordem=7");
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(7, json.GetProperty("ordem").GetInt32());
    }

    [Fact]
    public async Task Upload_do_cliente_recebe_403_e_nada_vai_ao_storage()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await UploadAsync(c, c.RelatorioId, UserRole.Client, c.ClienteId);
        using var deOutra = await UploadAsync(c, c.RelatorioId, UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Empty(c.Storage.Uploads);
        Assert.Equal(3, c.Relatorios.TotalFotos);
    }

    [Fact]
    public async Task Upload_em_relatorio_inexistente_retorna_404_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, Guid.NewGuid(), UserRole.Admin);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_ate_o_limite_de_100_fotos_e_recusa_a_101a_com_400()
    {
        var c = await CriarCenarioAsync();
        for (var i = 0; i < FotoRegras.MaxFotosPorRelatorio - 2; i++)
        {
            await c.Relatorios.AddFotoAsync(NovaFoto(c.ObraId, c.RelatorioId, 10 + i, null));
        }

        using var excedeu = await UploadAsync(c, c.RelatorioId, UserRole.Admin);
        var json = await JsonAsync(excedeu);

        Assert.Equal(HttpStatusCode.BadRequest, excedeu.StatusCode);
        Assert.Contains("100", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
        Assert.Equal(100, c.Relatorios.Inspecionar(c.RelatorioId)!.Fotos.Count);
    }

    [Fact]
    public async Task Upload_aceita_a_100a_foto()
    {
        var c = await CriarCenarioAsync();
        for (var i = 0; i < FotoRegras.MaxFotosPorRelatorio - 3; i++)
        {
            await c.Relatorios.AddFotoAsync(NovaFoto(c.ObraId, c.RelatorioId, 10 + i, null));
        }

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(100, c.Relatorios.Inspecionar(c.RelatorioId)!.Fotos.Count);
    }

    [Fact]
    public async Task Upload_com_nome_de_arquivo_maior_que_255_retorna_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();
        var nomeLongo = new string('a', 252) + ".png"; // 256 caracteres

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin, fileName: nomeLongo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("255", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
        Assert.Equal(2, c.Relatorios.Inspecionar(c.RelatorioId)!.Fotos.Count);
    }

    [Fact]
    public async Task Upload_com_nome_de_exatamente_255_caracteres_e_aceito()
    {
        var c = await CriarCenarioAsync();
        var nome = new string('a', 251) + ".png"; // 255 caracteres

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin, fileName: nome);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(c.Storage.Uploads);
    }

    [Theory]
    [InlineData("descricao=XXXX", "Descricao")]
    [InlineData("dataFoto=1999-12-31", "data")]
    [InlineData("ordem=-1", "ordem")]
    [InlineData("ordem=100001", "ordem")]
    public async Task Upload_com_metadados_invalidos_retorna_400_sem_tocar_no_storage(string query, string trecho)
    {
        var c = await CriarCenarioAsync();
        query = query.Replace("XXXX", new string('d', 256));

        using var response = await UploadAsync(c, c.RelatorioId, UserRole.Admin, query: "?" + query);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(trecho, json.GetProperty("message").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_com_data_no_futuro_distante_retorna_400_e_amanha_e_aceito()
    {
        var c = await CriarCenarioAsync();

        using var futuro = await UploadAsync(c, c.RelatorioId, UserRole.Admin, query: $"?dataFoto={DataDaqui(3)}");
        using var amanha = await UploadAsync(c, c.RelatorioId, UserRole.Admin, query: $"?dataFoto={DataDaqui(1)}");

        Assert.Equal(HttpStatusCode.BadRequest, futuro.StatusCode);
        Assert.Equal(HttpStatusCode.Created, amanha.StatusCode);
        Assert.Single(c.Storage.Uploads);
    }

    [Fact]
    public async Task Service_remove_o_objeto_do_storage_se_o_banco_falhar_depois_do_upload()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        c.Relatorios.FalharAoAdicionarFoto = true;
        using var conteudo = new MemoryStream(new byte[] { 0x89, 0x50, 0x4E, 0x47 });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UploadFotoAsync(c.RelatorioId, c.ObraId, conteudo, "x.png", "image/png", null, null, null));

        var chave = Assert.Single(c.Storage.Uploads);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.Equal(2, c.Relatorios.Inspecionar(c.RelatorioId)!.Fotos.Count);
    }

    [Fact]
    public async Task Service_apaga_o_objeto_se_o_limite_estourar_na_corrida_entre_a_checagem_e_o_insert()
    {
        var c = await CriarCenarioAsync();
        var repositorioCorrida = new RepositorioQueEstouraNaCorrida(c.Relatorios);
        var service = new RelatorioFotograficoService(
            repositorioCorrida, c.Storage, new FakeEtapaRepository(), new FakeObraRepository(), new LogAuditoriaService(c.Logs));
        using var conteudo = new MemoryStream(new byte[] { 0x89, 0x50, 0x4E, 0x47 });

        var resultado = await service.UploadFotoAsync(c.RelatorioId, c.ObraId, conteudo, "x.png", "image/png", null, null, null);

        Assert.Equal(FotoUploadStatus.LimiteExcedido, resultado.Status);
        var chave = Assert.Single(c.Storage.Uploads);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
    }

    [Fact]
    public async Task Service_nao_sobe_foto_em_relatorio_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        using var conteudo = new MemoryStream(new byte[] { 0x89, 0x50, 0x4E, 0x47 });

        var resultado = await service.UploadFotoAsync(c.RelatorioId, c.OutraObraId, conteudo, "x.png", "image/png", null, null, null);

        Assert.Equal(FotoUploadStatus.RelatorioNaoEncontrado, resultado.Status);
        Assert.Empty(c.Storage.Uploads);
    }

    /// <summary>Simula a corrida: a pre-checagem de contagem passa, mas o INSERT travado encontra o relatorio cheio.</summary>
    private sealed class RepositorioQueEstouraNaCorrida(FakeRelatorioFotograficoRepository inner) : IRelatorioFotograficoRepository
    {
        public Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio) => inner.CreateAsync(relatorio);
        public Task<Guid?> GetObraIdByIdAsync(Guid id) => inner.GetObraIdByIdAsync(id);
        public Task<RelatorioFotografico?> GetByIdAndObraAsync(Guid id, Guid obraId) => inner.GetByIdAndObraAsync(id, obraId);
        public Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId) => inner.GetByObraIdAsync(obraId);
        public Task<bool> UpdateAsync(RelatorioFotografico relatorio) => inner.UpdateAsync(relatorio);
        public Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId) => inner.DeleteAsync(id, obraId);
        public Task<int?> CountFotosAsync(Guid relatorioId, Guid obraId) => inner.CountFotosAsync(relatorioId, obraId);
        public Task<FotoInsertResult> TryAddFotoAsync(Foto foto, Guid obraId, int maxFotos, bool ordemNoFim) =>
            Task.FromResult(FotoInsertResult.LimiteExcedido);
        public Task<Guid?> GetObraIdByFotoIdAsync(Guid fotoId) => inner.GetObraIdByFotoIdAsync(fotoId);
        public Task<Foto?> GetFotoByIdAndObraAsync(Guid fotoId, Guid obraId) => inner.GetFotoByIdAndObraAsync(fotoId, obraId);
        public Task<Foto?> UpdateFotoAsync(Guid fotoId, Guid obraId, UpdateFotoRequest patch) => inner.UpdateFotoAsync(fotoId, obraId, patch);
        public Task<Foto?> DeleteFotoAsync(Guid fotoId, Guid obraId) => inner.DeleteFotoAsync(fotoId, obraId);
        public Task<bool> ReordenarFotosAsync(Guid relatorioId, Guid obraId, IReadOnlyList<(Guid Id, int Ordem)> itens) =>
            inner.ReordenarFotosAsync(relatorioId, obraId, itens);
    }

    // ===== PATCH /fotos/{fotoId} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Patch_altera_so_o_campo_enviado_e_audita_so_nomes_de_campos(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", role, atorId, new { descricao = "Fachada norte" });
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Fachada norte", json.GetProperty("descricao").GetString());
        Assert.Equal("2026-09-10", json.GetProperty("dataFoto").GetString());
        Assert.Equal(1, json.GetProperty("ordem").GetInt32());
        NaoVazaChaveDoBucket(texto);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("foto_editada", log.Acao);
        Assert.Equal("relatorio_fotografico", log.Entidade);
        Assert.Equal(c.RelatorioId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"campos\":[\"descricao\"]", log.Detalhes);
        Assert.Contains(c.Foto1Id.ToString(), log.Detalhes);
        Assert.DoesNotContain("Fachada", log.Detalhes);
    }

    [Fact]
    public async Task Patch_com_null_limpa_descricao_e_data_e_ordem_e_data_mudam_juntas()
    {
        var c = await CriarCenarioAsync();

        using var limpou = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Admin, body: new { descricao = (string?)null, dataFoto = (string?)null });
        using var mudou = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto2Id}", UserRole.Admin, body: new { dataFoto = "2026-10-02", ordem = 5 });

        Assert.Equal(HttpStatusCode.OK, limpou.StatusCode);
        Assert.Equal(HttpStatusCode.OK, mudou.StatusCode);
        var foto1 = c.Relatorios.InspecionarFoto(c.Foto1Id)!;
        Assert.Null(foto1.Descricao);
        Assert.Null(foto1.DataFoto);
        Assert.Equal(1, foto1.Ordem);
        var foto2 = c.Relatorios.InspecionarFoto(c.Foto2Id)!;
        Assert.Equal("Fundacao", foto2.Descricao);
        Assert.Equal(new DateOnly(2026, 10, 2), foto2.DataFoto);
        Assert.Equal(5, foto2.Ordem);
        Assert.Contains("\"campos\":[\"dataFoto\",\"ordem\"]", c.Logs.Logs.Last().Detalhes);
    }

    [Fact]
    public async Task Patch_com_descricao_so_de_espacos_limpa_o_campo()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Admin, body: new { descricao = "   " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(c.Relatorios.InspecionarFoto(c.Foto1Id)!.Descricao);
    }

    public static IEnumerable<object[]> CorposDePatchInvalidos() =>
    [
        [new Dictionary<string, object?>()],
        [new Dictionary<string, object?> { ["foo"] = 1 }],
        [new Dictionary<string, object?> { ["descricao"] = new string('d', 256) }],
        [new Dictionary<string, object?> { ["descricao"] = 5 }],
        [new Dictionary<string, object?> { ["dataFoto"] = "31/12/2026" }],
        [new Dictionary<string, object?> { ["dataFoto"] = "1999-12-31" }],
        [new Dictionary<string, object?> { ["dataFoto"] = "2999-01-01" }],
        [new Dictionary<string, object?> { ["ordem"] = -1 }],
        [new Dictionary<string, object?> { ["ordem"] = 100001 }],
        [new Dictionary<string, object?> { ["ordem"] = 1.5 }],
        [new Dictionary<string, object?> { ["ordem"] = null }],
        [new Dictionary<string, object?> { ["ordem"] = "2" }]
    ];

    [Theory]
    [MemberData(nameof(CorposDePatchInvalidos))]
    public async Task Patch_com_corpo_invalido_retorna_400_com_errors_e_nada_muda(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        var foto = c.Relatorios.InspecionarFoto(c.Foto1Id)!;
        Assert.Equal("Fachada", foto.Descricao);
        Assert.Equal(1, foto.Ordem);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Patch_do_cliente_recebe_403_antes_de_validar_o_corpo_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Client, c.ClienteId, new { descricao = "Hack" });
        using var invalido = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Client, c.ClienteId, new { ordem = "talvez" });
        using var deOutra = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", UserRole.Client, c.OutroClienteId, new { descricao = "Hack" });

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal("Fachada", c.Relatorios.InspecionarFoto(c.Foto1Id)!.Descricao);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Patch_anonimo_401_e_foto_inexistente_404_mesmo_com_corpo_invalido()
    {
        var c = await CriarCenarioAsync();

        using var anonimo = await SendAsync(c, HttpMethod.Patch, $"/fotos/{c.Foto1Id}", null, body: new { descricao = "x" });
        using var inexistente = await SendAsync(c, HttpMethod.Patch, $"/fotos/{Guid.NewGuid()}", UserRole.Admin, body: new { ordem = -1 });

        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
    }

    [Fact]
    public async Task Service_nao_edita_nem_remove_foto_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var edicao = await service.UpdateFotoAsync(
            c.Foto1Id, c.OutraObraId, new UpdateFotoRequest(true, "Invasao", false, null, false, 0), Guid.NewGuid());
        var remocao = await service.DeleteFotoAsync(c.Foto1Id, c.OutraObraId, Guid.NewGuid());

        Assert.Null(edicao);
        Assert.Null(remocao);
        Assert.Equal("Fachada", c.Relatorios.InspecionarFoto(c.Foto1Id)!.Descricao);
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== DELETE /fotos/{fotoId} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Delete_de_foto_remove_do_banco_e_do_storage_e_audita(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var chave = c.Relatorios.InspecionarFoto(c.Foto1Id)!.StorageKey;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/fotos/{c.Foto1Id}", role, atorId);
        using var download = await SendAsync(c, HttpMethod.Get, $"/fotos/{c.Foto1Id}/arquivo", role);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.Null(c.Relatorios.InspecionarFoto(c.Foto1Id));
        // Vizinhas intactas.
        Assert.NotNull(c.Relatorios.InspecionarFoto(c.Foto2Id));
        Assert.NotNull(c.Relatorios.InspecionarFoto(c.FotoDaOutraObraId));

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("foto_removida", log.Acao);
        Assert.Equal("relatorio_fotografico", log.Entidade);
        Assert.Equal(c.RelatorioId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains(c.Foto1Id.ToString(), log.Detalhes);
        Assert.DoesNotContain("Fachada", log.Detalhes);
    }

    [Fact]
    public async Task Delete_de_foto_responde_204_mesmo_se_o_storage_falhar()
    {
        var c = await CriarCenarioAsync();
        c.Storage.FalharAoApagar = true;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/fotos/{c.Foto1Id}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(c.Relatorios.InspecionarFoto(c.Foto1Id));
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_de_foto_do_cliente_403_anonimo_401_inexistente_404()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await SendAsync(c, HttpMethod.Delete, $"/fotos/{c.Foto1Id}", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Delete, $"/fotos/{c.Foto1Id}", UserRole.Client, c.OutroClienteId);
        using var anonimo = await SendAsync(c, HttpMethod.Delete, $"/fotos/{c.Foto1Id}", null);
        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/fotos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.NotNull(c.Relatorios.InspecionarFoto(c.Foto1Id));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== PATCH /relatorios-fotograficos/{id}/fotos/ordem =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Lote_reordena_devolve_as_fotos_na_nova_ordem_e_audita_uma_vez(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        // Inverte: Fachada (1) vai para 0 e Fundacao (0) vai para 1.
        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", role, atorId,
            new { fotos = new[] { new { id = c.Foto1Id, ordem = 0 }, new { id = c.Foto2Id, ordem = 1 } } });
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { c.Foto1Id, c.Foto2Id }, json.EnumerateArray().Select(f => f.GetProperty("id").GetGuid()).ToArray());
        NaoVazaChaveDoBucket(texto);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("fotos_reordenadas", log.Acao);
        Assert.Equal("relatorio_fotografico", log.Entidade);
        Assert.Equal(c.RelatorioId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"quantidade\":2", log.Detalhes);
        Assert.DoesNotContain("Fachada", log.Detalhes);
    }

    [Fact]
    public async Task Lote_com_foto_de_outra_obra_ou_inexistente_retorna_o_mesmo_400_e_nao_altera_nenhuma()
    {
        var c = await CriarCenarioAsync();

        using var deOutraObra = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = new[] { new { id = c.Foto1Id, ordem = 9 }, new { id = c.FotoDaOutraObraId, ordem = 8 } } });
        using var inexistente = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = new[] { new { id = c.Foto1Id, ordem = 9 }, new { id = Guid.NewGuid(), ordem = 8 } } });
        var textoOutra = await deOutraObra.Content.ReadAsStringAsync();
        var errosOutra = JsonDocument.Parse(textoOutra).RootElement.GetProperty("errors").GetRawText();
        var errosInexistente = (await JsonAsync(inexistente)).GetProperty("errors").GetRawText();

        Assert.Equal(HttpStatusCode.BadRequest, deOutraObra.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inexistente.StatusCode);
        // Mesmo erro: nao confirma que o id existe em outra obra.
        Assert.Equal(errosOutra, errosInexistente);
        Assert.Contains("Fotos", textoOutra);
        Assert.DoesNotContain(c.FotoDaOutraObraId.ToString(), textoOutra);

        Assert.Equal(1, c.Relatorios.InspecionarFoto(c.Foto1Id)!.Ordem);
        Assert.Equal(0, c.Relatorios.InspecionarFoto(c.Foto2Id)!.Ordem);
        Assert.Equal(0, c.Relatorios.InspecionarFoto(c.FotoDaOutraObraId)!.Ordem);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_com_foto_de_outro_relatorio_da_mesma_obra_tambem_e_recusado()
    {
        var c = await CriarCenarioAsync();
        var outroRelatorio = Guid.NewGuid();
        await c.Relatorios.CreateAsync(new RelatorioFotografico { Id = outroRelatorio, ObraId = c.ObraId, Tipo = "mensal", Titulo = "Agosto", CreatedAt = DateTime.UtcNow });
        var fotoDoOutro = NovaFoto(c.ObraId, outroRelatorio, 0, null);
        await c.Relatorios.AddFotoAsync(fotoDoOutro);

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = new[] { new { id = c.Foto1Id, ordem = 9 }, new { id = fotoDoOutro.Id, ordem = 8 } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, c.Relatorios.InspecionarFoto(c.Foto1Id)!.Ordem);
        Assert.Equal(0, c.Relatorios.InspecionarFoto(fotoDoOutro.Id)!.Ordem);
    }

    [Fact]
    public async Task Lote_do_cliente_recebe_403_antes_de_validar_o_corpo()
    {
        var c = await CriarCenarioAsync();
        var url = $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem";

        using var valido = await SendAsync(c, HttpMethod.Patch, url, UserRole.Client, c.ClienteId, new { fotos = new[] { new { id = c.Foto1Id, ordem = 0 } } });
        using var invalido = await SendAsync(c, HttpMethod.Patch, url, UserRole.Client, c.ClienteId, new { fotos = Array.Empty<object>() });
        using var deOutra = await SendAsync(c, HttpMethod.Patch, url, UserRole.Client, c.OutroClienteId, new { fotos = new[] { new { id = c.Foto1Id, ordem = 0 } } });
        using var anonimo = await SendAsync(c, HttpMethod.Patch, url, null, body: new { fotos = new[] { new { id = c.Foto1Id, ordem = 0 } } });

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(1, c.Relatorios.InspecionarFoto(c.Foto1Id)!.Ordem);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_em_relatorio_inexistente_retorna_404_mesmo_com_corpo_invalido()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{Guid.NewGuid()}/fotos/ordem", UserRole.Admin, body: new { fotos = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    public static IEnumerable<object[]> CorposDeLoteInvalidos() =>
    [
        [new { fotos = Array.Empty<object>() }],
        [new { fotos = new[] { new { id = Guid.Empty, ordem = 0 } } }],
        [new { fotos = new[] { new { id = Guid.NewGuid(), ordem = -1 } } }],
        [new { fotos = new[] { new { id = Guid.NewGuid(), ordem = 100001 } } }],
        [new { semFotos = true }]
    ];

    [Theory]
    [MemberData(nameof(CorposDeLoteInvalidos))]
    public async Task Lote_com_corpo_invalido_retorna_400_para_o_admin(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin, body: corpo);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_com_foto_repetida_retorna_400_e_nao_altera()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = new[] { new { id = c.Foto1Id, ordem = 5 }, new { id = c.Foto1Id, ordem = 6 } } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, c.Relatorios.InspecionarFoto(c.Foto1Id)!.Ordem);
    }

    [Fact]
    public async Task Lote_aceita_200_fotos_e_recusa_201()
    {
        var c = await CriarCenarioAsync();
        var ids = new List<Guid> { c.Foto1Id, c.Foto2Id };
        for (var i = 0; i < 199; i++)
        {
            var foto = NovaFoto(c.ObraId, c.RelatorioId, 100 + i, null);
            await c.Relatorios.AddFotoAsync(foto);
            ids.Add(foto.Id);
        }

        using var duzentos = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = ids.Take(200).Select((id, i) => new { id, ordem = i }).ToArray() });
        using var duzentosEUm = await SendAsync(
            c, HttpMethod.Patch, $"/relatorios-fotograficos/{c.RelatorioId}/fotos/ordem", UserRole.Admin,
            body: new { fotos = ids.Append(Guid.NewGuid()).Select((id, i) => new { id, ordem = i }).ToArray() });

        Assert.Equal(HttpStatusCode.OK, duzentos.StatusCode);
        // A resposta traz todas as fotos do relatorio (201), nao so as 200 reordenadas.
        Assert.Equal(201, (await JsonAsync(duzentos)).GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, duzentosEUm.StatusCode);
    }

    [Fact]
    public async Task Service_nao_reordena_relatorio_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var resultado = await service.ReordenarFotosAsync(
            c.RelatorioId, c.OutraObraId, new ReordenarFotosRequest([new FotoOrdemItem(c.Foto1Id, 9)]), Guid.NewGuid());

        Assert.Null(resultado);
        Assert.Equal(1, c.Relatorios.InspecionarFoto(c.Foto1Id)!.Ordem);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== Download =====

    [Fact]
    public async Task Download_continua_preso_a_obra_e_sai_com_nosniff()
    {
        var c = await CriarCenarioAsync();

        using var admin = await SendAsync(c, HttpMethod.Get, $"/fotos/{c.Foto1Id}/arquivo", UserRole.Admin);
        using var deOutra = await SendAsync(c, HttpMethod.Get, $"/fotos/{c.Foto1Id}/arquivo", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.OK, admin.StatusCode);
        Assert.Equal("nosniff", admin.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
    }
}
