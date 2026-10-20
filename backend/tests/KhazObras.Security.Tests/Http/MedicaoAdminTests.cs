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
/// Modulo Medicoes (admin + visao cliente), pipeline HTTP real com repositorios em memoria:
/// DTO reduzido do cliente (sem id interno de usuario), padrao de acesso (404 -> 403 -> corpo 400),
/// criacao com etapa da mesma obra, emissao de NF so a partir de approved (409), lista admin paginada
/// e auditoria (SPEC secao 8) em toda mudanca de status.
/// </summary>
public sealed class MedicaoAdminTests : IClassFixture<ApiFactory>
{
    private static readonly Guid ObraId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OutraObraId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private readonly ApiFactory _factory;

    public MedicaoAdminTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client,
        FakeMedicaoRepository Medicoes,
        FakeLogAuditoriaRepository Logs,
        Guid ClienteId,
        Guid OutroClienteId,
        Guid EtapaId,
        Guid EtapaOutraObraId,
        Guid AprovadorId);

    private async Task<Cenario> CriarCenarioAsync()
    {
        var medicoes = new FakeMedicaoRepository();
        var vinculos = new FakeUserObraRepository();
        var etapas = new FakeEtapaRepository();
        var obras = new FakeObraRepository();
        var logs = new FakeLogAuditoriaRepository();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, ObraId);
        await vinculos.LinkAsync(outroClienteId, OutraObraId);

        await obras.CreateAsync(new Obra { Id = ObraId, Nome = "Obra A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await obras.CreateAsync(new Obra { Id = OutraObraId, Nome = "Obra B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        var etapa = await etapas.CreateAsync(NovaEtapa(ObraId, "Fundacao"));
        var etapaOutra = await etapas.CreateAsync(NovaEtapa(OutraObraId, "Etapa alheia"));
        medicoes.NomesDeEtapa[etapa.Id] = "Fundacao";

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IMedicaoRepository>(medicoes);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IEtapaRepository>(etapas);
                services.AddSingleton<IObraRepository>(obras);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, medicoes, logs, clienteId, outroClienteId, etapa.Id, etapaOutra.Id, Guid.NewGuid());
    }

    private static Etapa NovaEtapa(Guid obraId, string nome) => new()
    {
        Id = Guid.NewGuid(),
        ObraId = obraId,
        Nome = nome,
        Ordem = 1,
        Status = "nao_iniciada",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static async Task<Guid> SemearAsync(
        Cenario c, MedicaoStatus status, int numero = 1, Guid? obraId = null, Guid? etapaId = null)
    {
        var id = Guid.NewGuid();
        await c.Medicoes.CreateAsync(new Medicao
        {
            Id = id,
            ObraId = obraId ?? ObraId,
            EtapaId = etapaId,
            Numero = numero,
            Competencia = new DateOnly(2026, 10, 1),
            ValorTotal = 5000m,
            Status = status,
            ApprovedAt = status == MedicaoStatus.PendingApproval ? null : DateTime.UtcNow,
            ApprovedByUserId = status == MedicaoStatus.PendingApproval ? null : c.AprovadorId,
            NfNumber = status == MedicaoStatus.InvoiceIssued ? "NF-1" : null,
            NfIssuedAt = status == MedicaoStatus.InvoiceIssued ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Itens =
            [
                new MedicaoItem
                {
                    Id = Guid.NewGuid(),
                    MedicaoId = id,
                    Tipo = ItemTipo.MaoDeObra,
                    Descricao = "Alvenaria",
                    Quantidade = 10m,
                    ValorUnitario = 500m,
                    ValorTotal = 5000m
                }
            ]
        });
        return id;
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

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static object Item(
        string tipo = "mao_de_obra", string descricao = "Alvenaria", decimal quantidade = 10m, decimal valorUnitario = 500m) =>
        new { tipo, descricao, quantidade, valorUnitario };

    private static object CorpoCriacao(
        Guid? obraId = null, Guid? etapaId = null, int numero = 1, string competencia = "2026-10-01", object[]? itens = null) =>
        new
        {
            obraId = obraId ?? ObraId,
            etapaId,
            numero,
            competencia,
            itens = itens ?? new object[] { Item() }
        };

    // ===== B3: visao do cliente nao recebe id interno =====

    [Fact]
    public async Task Cliente_nao_recebe_approvedByUserId_na_lista_nem_no_detalhe()
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/medicoes", UserRole.Client, c.ClienteId);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/medicoes/{id}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, lista.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detalhe.StatusCode);
        var listaJson = await JsonAsync(lista);
        var detalheJson = await JsonAsync(detalhe);

        Assert.Equal(JsonValueKind.Array, listaJson.ValueKind);
        Assert.False(listaJson[0].TryGetProperty("approvedByUserId", out _));
        Assert.False(detalheJson.TryGetProperty("approvedByUserId", out _));
        // O id do aprovador nao vaza nem como texto em lugar nenhum da resposta.
        Assert.DoesNotContain(c.AprovadorId.ToString(), listaJson.GetRawText());
        Assert.DoesNotContain(c.AprovadorId.ToString(), detalheJson.GetRawText());

        // O que o Fechamento consome segue igual.
        Assert.Equal("Approved", detalheJson.GetProperty("status").GetString());
        Assert.Equal(1, detalheJson.GetProperty("numero").GetInt32());
        Assert.Equal(5000m, detalheJson.GetProperty("valorTotal").GetDecimal());
        Assert.Equal(1, detalheJson.GetProperty("itens").GetArrayLength());
        Assert.True(detalheJson.TryGetProperty("nfNumber", out _));
    }

    [Fact]
    public async Task Cliente_ao_aprovar_recebe_visao_reduzida_e_a_auditoria_registra_o_cliente()
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.PendingApproval);

        using var response = await SendAsync(c, HttpMethod.Post, $"/medicoes/{id}/approve", UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Approved", json.GetProperty("status").GetString());
        Assert.False(json.TryGetProperty("approvedByUserId", out _));
        Assert.DoesNotContain(c.ClienteId.ToString(), json.GetRawText());

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("medicao_aprovada", log.Acao);
        Assert.Equal("medicao", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(c.ClienteId, log.UserId);
        Assert.Contains("\"statusAnterior\":\"pending_approval\"", log.Detalhes);
        Assert.Contains("\"statusNovo\":\"approved\"", log.Detalhes);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_veem_o_dto_completo_com_approvedByUserId(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/medicoes", role);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/medicoes/{id}", role);

        var listaJson = await JsonAsync(lista);
        var detalheJson = await JsonAsync(detalhe);

        Assert.Equal(c.AprovadorId, listaJson[0].GetProperty("approvedByUserId").GetGuid());
        Assert.Equal(c.AprovadorId, detalheJson.GetProperty("approvedByUserId").GetGuid());
    }

    // ===== Padrao de acesso: 404 -> 403 -> corpo =====

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_no_detalhe_na_lista_e_na_aprovacao()
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.PendingApproval);

        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/medicoes/{id}", UserRole.Client, c.OutroClienteId);
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/medicoes", UserRole.Client, c.OutroClienteId);
        using var aprovar = await SendAsync(c, HttpMethod.Post, $"/medicoes/{id}/approve", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, lista.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, aprovar.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    [InlineData(UserRole.Client)]
    public async Task Medicao_inexistente_retorna_404_no_detalhe(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/medicoes/{Guid.NewGuid()}", role, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Emitir_nf_de_medicao_inexistente_retorna_404_mesmo_com_corpo_invalido(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{Guid.NewGuid()}/issue-invoice", role, body: new { nfNumber = "" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ===== Criacao =====

    [Fact]
    public async Task Cliente_nao_cria_medicao_nem_com_corpo_invalido_e_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(c, HttpMethod.Post, "/medicoes", UserRole.Client, c.ClienteId, CorpoCriacao());
        using var invalido = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Client, c.ClienteId, CorpoCriacao(numero: 0));

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Empty(await c.Medicoes.GetByObraIdAsync(ObraId));
    }

    [Fact]
    public async Task Anonimo_nao_cria_medicao_e_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/medicoes", null, body: CorpoCriacao());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_criam_medicao_com_total_calculado_no_servidor_e_auditoria(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var corpo = CorpoCriacao(
            etapaId: c.EtapaId,
            itens: [Item(), Item("material", "Cimento", 2.5m, 100.10m)]);

        using var response = await SendAsync(c, HttpMethod.Post, "/medicoes", role, atorId, corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal($"/medicoes/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("PendingApproval", json.GetProperty("status").GetString());
        Assert.Equal(5250.25m, json.GetProperty("valorTotal").GetDecimal());
        Assert.Equal(2, json.GetProperty("itens").GetArrayLength());
        Assert.Equal(250.25m, json.GetProperty("itens")[1].GetProperty("valorTotal").GetDecimal());

        var salva = await c.Medicoes.GetByIdAndObraAsync(id, ObraId);
        Assert.NotNull(salva);
        Assert.Equal(MedicaoStatus.PendingApproval, salva!.Status);
        Assert.Equal(c.EtapaId, salva.EtapaId);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("medicao_criada", log.Acao);
        Assert.Equal("medicao", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"statusNovo\":\"pending_approval\"", log.Detalhes);
        // Sem valores nem descricoes no payload de auditoria.
        Assert.DoesNotContain("Alvenaria", log.Detalhes);
        Assert.DoesNotContain("5250", log.Detalhes);
    }

    [Fact]
    public async Task Total_enviado_pelo_cliente_da_requisicao_e_ignorado()
    {
        var c = await CriarCenarioAsync();
        var corpo = new
        {
            obraId = ObraId,
            numero = 1,
            competencia = "2026-10-01",
            valorTotal = 1m,
            itens = new object[] { new { tipo = "mao_de_obra", descricao = "Alvenaria", quantidade = 4m, valorUnitario = 25m, valorTotal = 1m } }
        };

        using var response = await SendAsync(c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(100m, json.GetProperty("valorTotal").GetDecimal());
    }

    [Fact]
    public async Task Criar_com_etapa_de_outra_obra_retorna_400_com_errors_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(etapaId: c.EtapaOutraObraId));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(json.GetProperty("errors").TryGetProperty("EtapaId", out _));
        Assert.Empty(await c.Medicoes.GetByObraIdAsync(ObraId));
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Criar_com_etapa_inexistente_retorna_400()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(etapaId: Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Criar_para_obra_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(obraId: Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Criar_com_numero_repetido_na_mesma_obra_retorna_409_e_em_outra_obra_e_aceito()
    {
        var c = await CriarCenarioAsync();
        await SemearAsync(c, MedicaoStatus.PendingApproval, numero: 1);

        using var repetido = await SendAsync(c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(numero: 1));
        using var outraObra = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(obraId: OutraObraId, numero: 1));

        Assert.Equal(HttpStatusCode.Conflict, repetido.StatusCode);
        Assert.Equal(HttpStatusCode.Created, outraObra.StatusCode);
    }

    public static IEnumerable<object[]> CorposInvalidos() =>
    [
        [CorpoCriacao(numero: 0)],
        [CorpoCriacao(numero: -3)],
        [CorpoCriacao(competencia: "0001-01-01")],
        [CorpoCriacao(itens: [])],
        [CorpoCriacao(itens: [Item(tipo: "outro")])],
        [CorpoCriacao(itens: [Item(tipo: "")])],
        [CorpoCriacao(itens: [Item(descricao: "")])],
        [CorpoCriacao(itens: [Item(descricao: new string('x', 256))])],
        [CorpoCriacao(itens: [Item(quantidade: 0m)])],
        [CorpoCriacao(itens: [Item(quantidade: -1m)])],
        [CorpoCriacao(itens: [Item(quantidade: 1.234m)])],
        [CorpoCriacao(itens: [Item(valorUnitario: -0.01m)])],
        [CorpoCriacao(itens: [Item(valorUnitario: 10.123m)])],
        [CorpoCriacao(itens: [Item(quantidade: 10_000_000_000m)])],
        [CorpoCriacao(itens: [Item(quantidade: 9_000_000_000m, valorUnitario: 999_999_999m)])]
    ];

    [Theory]
    [MemberData(nameof(CorposInvalidos))]
    public async Task Corpo_invalido_retorna_400_com_errors_e_nada_e_gravado(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        Assert.Empty(await c.Medicoes.GetByObraIdAsync(ObraId));
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Item_com_valor_unitario_zero_e_aceito()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao(itens: [Item(valorUnitario: 0m)]));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    // ===== Emissao de NF =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_emitem_nf_de_medicao_aprovada_com_auditoria(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);
        var atorId = Guid.NewGuid();

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", role, atorId, new { nfNumber = "  NF-2026-0042  " });
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("InvoiceIssued", json.GetProperty("status").GetString());
        Assert.Equal("NF-2026-0042", json.GetProperty("nfNumber").GetString());

        var salva = await c.Medicoes.GetByIdAndObraAsync(id, ObraId);
        Assert.Equal(MedicaoStatus.InvoiceIssued, salva!.Status);
        Assert.Equal("NF-2026-0042", salva.NfNumber);
        Assert.NotNull(salva.NfIssuedAt);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("medicao_nf_emitida", log.Acao);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"statusAnterior\":\"approved\"", log.Detalhes);
        Assert.Contains("\"statusNovo\":\"invoice_issued\"", log.Detalhes);
        Assert.DoesNotContain("NF-2026-0042", log.Detalhes);
    }

    [Theory]
    [InlineData(MedicaoStatus.PendingApproval)]
    [InlineData(MedicaoStatus.InvoiceIssued)]
    public async Task Emitir_nf_fora_do_status_approved_retorna_409_e_nada_muda(MedicaoStatus status)
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, status);
        var antes = await c.Medicoes.GetByIdAndObraAsync(id, ObraId);
        var nfAntes = antes!.NfNumber;

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", UserRole.Admin, body: new { nfNumber = "NF-9" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var depois = await c.Medicoes.GetByIdAndObraAsync(id, ObraId);
        Assert.Equal(status, depois!.Status);
        Assert.Equal(nfAntes, depois.NfNumber);
        Assert.Empty(c.Logs.Logs);
    }

    public static IEnumerable<object[]> NfInvalidas() =>
    [
        [new { nfNumber = "" }],
        [new { nfNumber = "   " }],
        [new { nfNumber = new string('9', 51) }],
        [new { nfNumber = "NF\n1" }]
    ];

    [Theory]
    [MemberData(nameof(NfInvalidas))]
    public async Task Emitir_nf_com_numero_invalido_retorna_400_com_errors_e_nada_muda(object corpo)
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);

        using var response = await SendAsync(c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        Assert.Equal(MedicaoStatus.Approved, (await c.Medicoes.GetByIdAndObraAsync(id, ObraId))!.Status);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Emitir_nf_com_50_caracteres_e_aceito()
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", UserRole.Admin, body: new { nfNumber = new string('9', 50) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_nao_emite_nf_e_recebe_403()
    {
        var c = await CriarCenarioAsync();
        var id = await SemearAsync(c, MedicaoStatus.Approved);

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", UserRole.Client, c.ClienteId, new { nfNumber = "NF-1" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(MedicaoStatus.Approved, (await c.Medicoes.GetByIdAndObraAsync(id, ObraId))!.Status);
    }

    [Fact]
    public async Task Fluxo_completo_cria_aprova_e_emite_nf_com_tres_registros_de_auditoria()
    {
        var c = await CriarCenarioAsync();

        using var criada = await SendAsync(c, HttpMethod.Post, "/medicoes", UserRole.Admin, body: CorpoCriacao());
        var id = (await JsonAsync(criada)).GetProperty("id").GetGuid();
        using var aprovada = await SendAsync(c, HttpMethod.Post, $"/medicoes/{id}/approve", UserRole.Client, c.ClienteId);
        using var emitida = await SendAsync(
            c, HttpMethod.Post, $"/medicoes/{id}/issue-invoice", UserRole.Admin, body: new { nfNumber = "NF-1" });

        Assert.Equal(HttpStatusCode.Created, criada.StatusCode);
        Assert.Equal(HttpStatusCode.OK, aprovada.StatusCode);
        Assert.Equal(HttpStatusCode.OK, emitida.StatusCode);
        Assert.Equal(
            new[] { "medicao_criada", "medicao_aprovada", "medicao_nf_emitida" },
            c.Logs.Logs.Select(l => l.Acao).ToArray());
        Assert.All(c.Logs.Logs, l => Assert.Equal(id, l.EntidadeId));
    }

    // ===== Lista admin (resumo paginado) =====

    [Fact]
    public async Task Resumo_devolve_pagina_com_campos_de_acompanhamento_mais_nova_primeiro()
    {
        var c = await CriarCenarioAsync();
        await SemearAsync(c, MedicaoStatus.InvoiceIssued, numero: 1, etapaId: c.EtapaId);
        await SemearAsync(c, MedicaoStatus.Approved, numero: 2);
        await SemearAsync(c, MedicaoStatus.PendingApproval, numero: 3);
        await SemearAsync(c, MedicaoStatus.PendingApproval, numero: 1, obraId: OutraObraId);

        using var response = await SendAsync(
            c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo?pageIndex=0&pageSize=2", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(3, json.GetProperty("totalItems").GetInt32());
        Assert.Equal(0, json.GetProperty("pageIndex").GetInt32());
        Assert.Equal(2, json.GetProperty("pageSize").GetInt32());
        var items = json.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal(3, items[0].GetProperty("numero").GetInt32());
        Assert.Equal("PendingApproval", items[0].GetProperty("status").GetString());
        Assert.Equal(1, items[0].GetProperty("quantidadeItens").GetInt32());
        Assert.False(items[0].TryGetProperty("itens", out _));

        using var segunda = await SendAsync(
            c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo?pageIndex=1&pageSize=2", UserRole.Master);
        var itemsSegunda = (await JsonAsync(segunda)).GetProperty("items");
        Assert.Equal(1, itemsSegunda.GetArrayLength());
        var primeira = itemsSegunda[0];
        Assert.Equal(1, primeira.GetProperty("numero").GetInt32());
        Assert.Equal("InvoiceIssued", primeira.GetProperty("status").GetString());
        Assert.Equal("Fundacao", primeira.GetProperty("etapaNome").GetString());
        Assert.Equal("NF-1", primeira.GetProperty("nfNumber").GetString());
        Assert.Equal(5000m, primeira.GetProperty("valorTotal").GetDecimal());
        Assert.Equal("2026-10-01", primeira.GetProperty("competencia").GetString());
        foreach (var campo in new[] { "createdAt", "approvedAt", "nfIssuedAt", "etapaId", "obraId", "id" })
        {
            Assert.True(primeira.TryGetProperty(campo, out _), campo);
        }
    }

    [Fact]
    public async Task Resumo_filtra_por_status()
    {
        var c = await CriarCenarioAsync();
        await SemearAsync(c, MedicaoStatus.Approved, numero: 1);
        await SemearAsync(c, MedicaoStatus.PendingApproval, numero: 2);

        using var response = await SendAsync(
            c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo?status=approved", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(1, json.GetProperty("totalItems").GetInt32());
        Assert.Equal(1, json.GetProperty("items")[0].GetProperty("numero").GetInt32());
    }

    [Theory]
    [InlineData("pageIndex=-1")]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    [InlineData("status=Approved2")]
    public async Task Resumo_com_parametros_invalidos_retorna_400(string query)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo?{query}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Resumo_e_restrito_a_admin_e_master()
    {
        var c = await CriarCenarioAsync();

        using var cliente = await SendAsync(
            c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo", UserRole.Client, c.ClienteId);
        using var anonimo = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/medicoes/resumo", null);

        Assert.Equal(HttpStatusCode.Forbidden, cliente.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
    }

    // ===== Repositorio: tudo preso a obra =====

    [Fact]
    public async Task Consultas_e_updates_do_repositorio_sao_presos_a_obra()
    {
        var c = await CriarCenarioAsync();
        var pendente = await SemearAsync(c, MedicaoStatus.PendingApproval, numero: 1);
        var aprovada = await SemearAsync(c, MedicaoStatus.Approved, numero: 2);

        Assert.Null(await c.Medicoes.GetByIdAndObraAsync(pendente, OutraObraId));
        Assert.False(await c.Medicoes.ApproveAsync(pendente, OutraObraId, Guid.NewGuid(), DateTime.UtcNow));
        Assert.False(await c.Medicoes.IssueInvoiceAsync(aprovada, OutraObraId, "NF-X", DateTime.UtcNow));

        Assert.Equal(MedicaoStatus.PendingApproval, (await c.Medicoes.GetByIdAndObraAsync(pendente, ObraId))!.Status);
        Assert.Equal(MedicaoStatus.Approved, (await c.Medicoes.GetByIdAndObraAsync(aprovada, ObraId))!.Status);
    }
}
