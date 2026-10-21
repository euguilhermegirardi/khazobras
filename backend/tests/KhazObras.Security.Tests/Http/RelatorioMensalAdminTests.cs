using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosMensais;
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
/// Relatorio ao cliente no admin (criar, editar rascunho, excluir rascunho, publicar, historico), pipeline HTTP real com
/// repositorios em memoria. Padrao: 404 -> 403 -> corpo 400 -> 409 (cliente nunca escreve: 403 antes de ler o corpo).
/// O SQL condicional (<c>WHERE status = 'draft'</c>, <c>ON CONFLICT</c>) so roda com Postgres de verdade; o fake o espelha.
/// </summary>
public sealed class RelatorioMensalAdminTests : IClassFixture<ApiFactory>
{
    private const string Marcador = "TEXTO-LIVRE-SECRETO-9f3a";

    private readonly ApiFactory _factory;

    public RelatorioMensalAdminTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client,
        FakeRelatorioMensalRepository Relatorios,
        FakeLogAuditoriaRepository Logs,
        Guid AdminId,
        Guid ObraId,
        Guid OutraObraId,
        Guid ClienteId,
        Guid OutroClienteId,
        Guid RascunhoId,
        Guid PublicadoId,
        Guid RascunhoDaOutraObraId);

    private static RelatorioMensal Novo(Guid obraId, string status, DateOnly competencia, string conteudo = "texto") => new()
    {
        Id = Guid.NewGuid(),
        ObraId = obraId,
        Competencia = competencia,
        Conteudo = conteudo,
        Status = status,
        PublishedAt = status == "published" ? DateTime.UtcNow : null,
        CreatedByUserId = Guid.NewGuid(),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private async Task<Cenario> CriarCenarioAsync()
    {
        var relatorios = new FakeRelatorioMensalRepository();
        var vinculos = new FakeUserObraRepository();
        var obras = new FakeObraRepository();
        var usuarios = new FakeUserRepository();
        var logs = new FakeLogAuditoriaRepository();
        var adminId = Guid.NewGuid();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await vinculos.LinkAsync(outroClienteId, outraObraId);
        await obras.CreateAsync(new Obra { Id = obraId, Nome = "Obra A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await obras.CreateAsync(new Obra { Id = outraObraId, Nome = "Obra B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await usuarios.CreateAsync(new User { Id = adminId, Name = "Ana Admin", Email = "ana@example.com", Role = UserRole.Admin, IsActive = true });

        var rascunho = Novo(obraId, "draft", new DateOnly(2026, 9, 1));
        var publicado = Novo(obraId, "published", new DateOnly(2026, 8, 1));
        var rascunhoOutra = Novo(outraObraId, "draft", new DateOnly(2026, 9, 1));
        await relatorios.CreateAsync(rascunho);
        await relatorios.CreateAsync(publicado);
        await relatorios.CreateAsync(rascunhoOutra);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IRelatorioMensalRepository>(relatorios);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IObraRepository>(obras);
                services.AddSingleton<IUserRepository>(usuarios);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, relatorios, logs, adminId, obraId, outraObraId, clienteId, outroClienteId,
            rascunho.Id, publicado.Id, rascunhoOutra.Id);
    }

    private static RelatorioMensalService NovoService(Cenario c) => new(
        c.Relatorios, new FakeObraRepository(), new FakeUserRepository(), new LogAuditoriaService(c.Logs));

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

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static object CorpoCriar(Guid obraId, string competencia = "2026-10-17", string conteudo = "Obra segue no prazo.") =>
        new { obraId, competencia, conteudo };

    private static object CorpoEditar(string competencia = "2026-09-01", string conteudo = "Texto novo.") =>
        new { competencia, conteudo };

    // ===== Autorizacao: cliente nunca escreve, anonimo = 401 =====

    [Theory]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    [InlineData("POST")]
    [InlineData("GET")]
    public async Task Cliente_da_propria_obra_recebe_403_em_editar_excluir_publicar_e_historico(string metodo)
    {
        var c = await CriarCenarioAsync();
        var url = metodo switch
        {
            "POST" => $"/relatorios-mensais/{c.RascunhoId}/publish",
            "GET" => $"/relatorios-mensais/{c.RascunhoId}/historico",
            _ => $"/relatorios-mensais/{c.RascunhoId}"
        };

        // Corpo invalido de proposito: o 403 nao pode depender do conteudo enviado.
        using var response = await SendAsync(c, new HttpMethod(metodo), url, UserRole.Client, c.ClienteId,
            metodo == "PUT" ? new { competencia = "0001-01-01", conteudo = "" } : null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("draft", c.Relatorios.Todos.Single(r => r.Id == c.RascunhoId).Status);
        Assert.Equal(3, c.Relatorios.Todos.Count);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Cliente_cria_relatorio_com_corpo_invalido_recebe_403_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Client, c.ClienteId,
            new { obraId = c.ObraId, competencia = "0001-01-01", conteudo = "" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(3, c.Relatorios.Todos.Count);
        Assert.Empty(c.Logs.Logs);
    }

    [Theory]
    [InlineData("POST", "/relatorios-mensais")]
    [InlineData("PUT", "/relatorios-mensais/11111111-1111-1111-1111-111111111111")]
    [InlineData("DELETE", "/relatorios-mensais/11111111-1111-1111-1111-111111111111")]
    [InlineData("POST", "/relatorios-mensais/11111111-1111-1111-1111-111111111111/publish")]
    [InlineData("GET", "/relatorios-mensais/11111111-1111-1111-1111-111111111111/historico")]
    public async Task Anonimo_recebe_401(string metodo, string url)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, new HttpMethod(metodo), url, role: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ===== Criar =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Criar_devolve_201_em_rascunho_com_competencia_no_dia_1_e_audita_so_ids(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", role, c.AdminId,
            CorpoCriar(c.ObraId, "2026-10-17", $"  {Marcador}  "));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await JsonAsync(response);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal($"/relatorios-mensais/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("draft", json.GetProperty("status").GetString());
        Assert.Equal("2026-10-01", json.GetProperty("competencia").GetString());
        Assert.Equal(Marcador, json.GetProperty("conteudo").GetString());
        Assert.Equal(c.AdminId, json.GetProperty("createdByUserId").GetGuid());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("publishedAt").ValueKind);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_mensal_criado", log.Acao);
        Assert.Equal("relatorio_mensal", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(c.AdminId, log.UserId);
        Assert.Contains($"\"obraId\":\"{c.ObraId}\"", log.Detalhes);
        Assert.DoesNotContain(Marcador, log.Detalhes);
    }

    [Fact]
    public async Task Criar_em_obra_inexistente_devolve_404_e_nao_500()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(3, c.Relatorios.Todos.Count);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Criar_no_mes_que_ja_tem_relatorio_devolve_409_mesmo_com_outro_dia()
    {
        var c = await CriarCenarioAsync();

        // O rascunho do cenario esta em 2026-09-01; 2026-09-25 normaliza para o mesmo mes.
        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-09-25"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(3, c.Relatorios.Todos.Count);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Criar_no_mesmo_mes_de_outra_obra_e_permitido()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.OutraObraId, "2026-08-10"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData("", "2026-10-01", "Conteudo")]
    [InlineData("   ", "2026-10-01", "Conteudo")]
    [InlineData("texto", "1999-12-01", "Competencia")]
    [InlineData("texto", "2101-01-01", "Competencia")]
    [InlineData("texto", "0001-01-01", "Competencia")]
    public async Task Criar_com_corpo_invalido_devolve_400_com_o_campo(string conteudo, string competencia, string campo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, competencia, conteudo));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await JsonAsync(response)).GetProperty("errors").TryGetProperty(campo, out _));
        Assert.Equal(3, c.Relatorios.Todos.Count);
    }

    [Fact]
    public async Task Criar_com_conteudo_acima_do_limite_ou_com_controle_devolve_400()
    {
        var c = await CriarCenarioAsync();
        var noLimite = new string('a', RelatorioMensalRegras.MaxConteudo);

        using var longo = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-11-01", noLimite + "a"));
        using var nulo = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-11-01", "ola\u0000mundo"));
        using var direcao = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-11-01", "ola‮mundo"));
        using var ok = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-11-01", noLimite));

        Assert.Equal(HttpStatusCode.BadRequest, longo.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, nulo.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, direcao.StatusCode);
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task Criar_aceita_quebra_de_linha_e_nao_interpreta_html()
    {
        var c = await CriarCenarioAsync();
        const string texto = "Linha 1\nLinha 2\t<script>alert(1)</script>";

        using var response = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-12-01", texto));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        // O servidor guarda e devolve o texto como veio (o front o exibe como texto, nunca como HTML).
        Assert.Equal(texto, (await JsonAsync(response)).GetProperty("conteudo").GetString());
    }

    // ===== Editar =====

    [Fact]
    public async Task Editar_rascunho_devolve_200_e_audita_so_o_nome_dos_campos()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-09-20", Marcador));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await JsonAsync(response);
        Assert.Equal("draft", json.GetProperty("status").GetString());
        Assert.Equal(Marcador, json.GetProperty("conteudo").GetString());
        Assert.Equal("2026-09-01", json.GetProperty("competencia").GetString());

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_mensal_editado", log.Acao);
        Assert.Equal(c.RascunhoId, log.EntidadeId);
        Assert.Contains("\"campos\":[\"conteudo\"]", log.Detalhes);
        Assert.DoesNotContain(Marcador, log.Detalhes);
    }

    [Fact]
    public async Task Editar_competencia_registra_o_campo_e_mes_ja_usado_devolve_409()
    {
        var c = await CriarCenarioAsync();

        using var muda = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-10-05", "texto"));
        using var duplicada = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-08-01", "texto"));

        Assert.Equal(HttpStatusCode.OK, muda.StatusCode);
        Assert.Equal("2026-10-01", (await JsonAsync(muda)).GetProperty("competencia").GetString());
        Assert.Contains("\"campos\":[\"competencia\"]", Assert.Single(c.Logs.Logs).Detalhes);
        // 2026-08-01 e do relatorio publicado do cenario.
        Assert.Equal(HttpStatusCode.Conflict, duplicada.StatusCode);
        Assert.Equal(new DateOnly(2026, 10, 1), c.Relatorios.Todos.Single(r => r.Id == c.RascunhoId).Competencia);
    }

    [Fact]
    public async Task Editar_sem_mudar_nada_nao_grava_auditoria()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-09-01", "texto"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Editar_publicado_devolve_409_e_nao_altera()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-08-01", Marcador));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("texto", c.Relatorios.Todos.Single(r => r.Id == c.PublicadoId).Conteudo);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Editar_com_corpo_invalido_devolve_400_antes_do_409()
    {
        var c = await CriarCenarioAsync();

        // Publicado + corpo invalido: o corpo vem primeiro (400), o estado depois (409).
        using var response = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-08-01", ""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await JsonAsync(response)).GetProperty("errors").TryGetProperty("Conteudo", out _));
    }

    [Fact]
    public async Task Editar_id_inexistente_devolve_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{Guid.NewGuid()}", UserRole.Admin, c.AdminId,
            CorpoEditar());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ===== Excluir =====

    [Fact]
    public async Task Excluir_rascunho_devolve_204_e_audita_so_ids()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(c.Relatorios.Todos, r => r.Id == c.RascunhoId);
        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_mensal_excluido", log.Acao);
        Assert.Equal(c.RascunhoId, log.EntidadeId);
        Assert.Equal($"{{\"obraId\":\"{c.ObraId}\"}}", log.Detalhes);
    }

    [Fact]
    public async Task Excluir_publicado_devolve_409_e_mantem()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains(c.Relatorios.Todos, r => r.Id == c.PublicadoId);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Excluir_id_inexistente_devolve_404_e_depois_de_excluido_tambem()
    {
        var c = await CriarCenarioAsync();

        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{Guid.NewGuid()}", UserRole.Admin, c.AdminId);
        using var primeira = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId);
        using var segunda = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, segunda.StatusCode);
        Assert.Single(c.Logs.Logs);
    }

    // ===== Publicar =====

    [Fact]
    public async Task Publicar_devolve_200_com_publishedAt_e_audita_so_ids()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.RascunhoId}/publish", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await JsonAsync(response);
        Assert.Equal("published", json.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, json.GetProperty("publishedAt").ValueKind);
        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("relatorio_mensal_publicado", log.Acao);
        Assert.Equal($"{{\"obraId\":\"{c.ObraId}\"}}", log.Detalhes);
    }

    [Fact]
    public async Task Publicar_duas_vezes_devolve_409_na_segunda_e_so_uma_auditoria()
    {
        var c = await CriarCenarioAsync();

        using var primeira = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.RascunhoId}/publish", UserRole.Admin, c.AdminId);
        var publicadoEm = c.Relatorios.Todos.Single(r => r.Id == c.RascunhoId).PublishedAt;
        using var segunda = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.RascunhoId}/publish", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.OK, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
        Assert.Equal(publicadoEm, c.Relatorios.Todos.Single(r => r.Id == c.RascunhoId).PublishedAt);
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Publicar_ja_publicado_do_cenario_devolve_409_e_inexistente_404()
    {
        var c = await CriarCenarioAsync();

        using var ja = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.PublicadoId}/publish", UserRole.Admin, c.AdminId);
        using var inexistente = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{Guid.NewGuid()}/publish", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.Conflict, ja.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Depois_de_publicado_nao_edita_nem_exclui()
    {
        var c = await CriarCenarioAsync();
        using var publica = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.RascunhoId}/publish", UserRole.Admin, c.AdminId);

        using var edita = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId, CorpoEditar());
        using var exclui = await SendAsync(c, HttpMethod.Delete, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.OK, publica.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, edita.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, exclui.StatusCode);
    }

    // ===== Preso a obra no repositorio (defense in depth) =====

    [Fact]
    public async Task Service_nao_altera_relatorio_de_outra_obra_mesmo_com_o_id_certo()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var edita = await service.UpdateAsync(c.RascunhoDaOutraObraId, c.ObraId,
            new UpdateRelatorioMensalRequest(new DateOnly(2026, 9, 1), Marcador), c.AdminId);
        var publica = await service.PublishAsync(c.RascunhoDaOutraObraId, c.ObraId, c.AdminId);
        var exclui = await service.DeleteAsync(c.RascunhoDaOutraObraId, c.ObraId, c.AdminId);
        var le = await service.GetByIdAndObraAsync(c.RascunhoDaOutraObraId, c.ObraId);
        var historico = await service.GetHistoricoAsync(c.RascunhoDaOutraObraId, c.ObraId);

        Assert.Equal(RelatorioMensalWriteStatus.NaoEncontrado, edita.Status);
        Assert.Equal(RelatorioMensalWriteStatus.NaoEncontrado, publica.Status);
        Assert.Equal(RelatorioMensalWriteStatus.NaoEncontrado, exclui);
        Assert.Null(le);
        Assert.Null(historico);
        var intacto = c.Relatorios.Todos.Single(r => r.Id == c.RascunhoDaOutraObraId);
        Assert.Equal("draft", intacto.Status);
        Assert.Equal("texto", intacto.Conteudo);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== Leitura =====

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_ao_ler_e_nao_escreve()
    {
        var c = await CriarCenarioAsync();

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Client, c.OutroClienteId);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-mensais", UserRole.Client, c.OutroClienteId);
        using var edita = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Client, c.OutroClienteId, CorpoEditar());
        using var publica = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{c.RascunhoId}/publish", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, lista.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, edita.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, publica.StatusCode);
    }

    [Fact]
    public async Task Cliente_ve_so_publicado_e_o_JSON_nao_tem_campos_internos()
    {
        var c = await CriarCenarioAsync();

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{c.PublicadoId}", UserRole.Client, c.ClienteId);
        using var rascunho = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{c.RascunhoId}", UserRole.Client, c.ClienteId);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-mensais?onlyPublished=false", UserRole.Client, c.ClienteId);
        using var historico = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{c.PublicadoId}/historico", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, rascunho.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, historico.StatusCode);

        var chaves = (await JsonAsync(detalhe)).EnumerateObject().Select(p => p.Name).OrderBy(n => n).ToArray();
        Assert.Equal(new[] { "competencia", "conteudo", "createdAt", "id", "obraId", "publishedAt", "status" }, chaves);

        var itens = (await JsonAsync(lista)).EnumerateArray().ToList();
        Assert.Single(itens);
        Assert.Equal(c.PublicadoId, itens[0].GetProperty("id").GetGuid());
        Assert.False(itens[0].TryGetProperty("createdByUserId", out _));
        Assert.False(itens[0].TryGetProperty("updatedAt", out _));
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_ve_todos_com_competencia_mais_nova_primeiro(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-mensais", role);
        using var publicados = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/relatorios-mensais?onlyPublished=true", role);

        var itens = (await JsonAsync(lista)).EnumerateArray().ToList();
        Assert.Equal(new[] { c.RascunhoId, c.PublicadoId }, itens.Select(i => i.GetProperty("id").GetGuid()).ToArray());
        Assert.True(itens[0].TryGetProperty("createdByUserId", out _));
        Assert.True(itens[0].TryGetProperty("updatedAt", out _));
        Assert.Single((await JsonAsync(publicados)).EnumerateArray());
    }

    [Fact]
    public async Task Detalhe_de_id_inexistente_devolve_404()
    {
        var c = await CriarCenarioAsync();

        using var admin = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{Guid.NewGuid()}", UserRole.Admin);
        using var cliente = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{Guid.NewGuid()}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, admin.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, cliente.StatusCode);
    }

    // ===== Historico =====

    [Fact]
    public async Task Historico_lista_criado_editado_publicado_com_nome_e_sem_texto()
    {
        var c = await CriarCenarioAsync();
        using var cria = await SendAsync(c, HttpMethod.Post, "/relatorios-mensais", UserRole.Admin, c.AdminId,
            CorpoCriar(c.ObraId, "2026-10-01", Marcador));
        var id = (await JsonAsync(cria)).GetProperty("id").GetGuid();
        using var edita = await SendAsync(c, HttpMethod.Put, $"/relatorios-mensais/{id}", UserRole.Admin, c.AdminId,
            CorpoEditar("2026-10-01", Marcador + " v2"));
        using var publica = await SendAsync(c, HttpMethod.Post, $"/relatorios-mensais/{id}/publish", UserRole.Admin, c.AdminId);

        using var response = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{id}/historico", UserRole.Admin, c.AdminId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var texto = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(Marcador, texto);
        var itens = JsonDocument.Parse(texto).RootElement.EnumerateArray().ToList();
        Assert.Equal(
            new[] { "relatorio_mensal_publicado", "relatorio_mensal_editado", "relatorio_mensal_criado" },
            itens.Select(i => i.GetProperty("acao").GetString()).ToArray());
        Assert.All(itens, i => Assert.Equal("Ana Admin", i.GetProperty("userName").GetString()));
        Assert.Equal("conteudo", itens[1].GetProperty("campos").EnumerateArray().Single().GetString());
        Assert.Empty(itens[0].GetProperty("campos").EnumerateArray());
    }

    [Fact]
    public async Task Historico_de_id_inexistente_devolve_404_e_de_relatorio_sem_registro_devolve_lista_vazia()
    {
        var c = await CriarCenarioAsync();

        using var inexistente = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{Guid.NewGuid()}/historico", UserRole.Admin);
        using var semRegistro = await SendAsync(c, HttpMethod.Get, $"/relatorios-mensais/{c.PublicadoId}/historico", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.Equal(HttpStatusCode.OK, semRegistro.StatusCode);
        Assert.Empty((await JsonAsync(semRegistro)).EnumerateArray());
    }
}
