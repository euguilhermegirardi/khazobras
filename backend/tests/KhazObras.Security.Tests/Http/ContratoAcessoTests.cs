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
/// Modulo Contratos + Pagamentos, pipeline HTTP real com repositorios em memoria: DTO reduzido do cliente (sem
/// storage_key nem campos internos), padrao de acesso (404 -> 403 -> corpo 400 -> 409), totais e saldo calculados no
/// servidor, vinculo do pagamento a medicao da mesma obra com NF emitida e auditoria (SPEC secao 8).
/// </summary>
public sealed class ContratoAcessoTests : IClassFixture<ApiFactory>
{
    private static readonly Guid ObraId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OutraObraId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string ChaveInterna = "contratos/chave-interna-do-bucket.pdf";

    private readonly ApiFactory _factory;

    public ContratoAcessoTests(ApiFactory factory) => _factory = factory;

    private sealed record Cenario(
        HttpClient Client,
        FakeContratoRepository Contratos,
        FakeMedicaoRepository Medicoes,
        FakeLogAuditoriaRepository Logs,
        Guid ClienteId,
        Guid OutroClienteId);

    private async Task<Cenario> CriarCenarioAsync()
    {
        var medicoes = new FakeMedicaoRepository();
        var contratos = new FakeContratoRepository(medicoes);
        var vinculos = new FakeUserObraRepository();
        var obras = new FakeObraRepository();
        var logs = new FakeLogAuditoriaRepository();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, ObraId);
        await vinculos.LinkAsync(outroClienteId, OutraObraId);

        await obras.CreateAsync(new Obra { Id = ObraId, Nome = "Obra A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await obras.CreateAsync(new Obra { Id = OutraObraId, Nome = "Obra B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IContratoRepository>(contratos);
                services.AddSingleton<IMedicaoRepository>(medicoes);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IObraRepository>(obras);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, contratos, medicoes, logs, clienteId, outroClienteId);
    }

    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);

    private static string Data(DateOnly d) => d.ToString("yyyy-MM-dd");

    private static async Task<Guid> SemearContratoAsync(
        Cenario c, string numero = "CT-001", decimal valor = 10_000m, Guid? obraId = null, string? storageKey = ChaveInterna)
    {
        var id = Guid.NewGuid();
        await c.Contratos.CreateAsync(new Contrato
        {
            Id = id,
            ObraId = obraId ?? ObraId,
            Numero = numero,
            ValorContratado = valor,
            DataAssinatura = new DateOnly(2026, 3, 15),
            StorageKey = storageKey,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        return id;
    }

    private static Guid SemearPagamento(
        Cenario c, Guid contratoId, decimal valor, DateOnly data, string? forma = "PIX", Guid? medicaoId = null,
        int criadoHaMinutos = 0)
    {
        var id = Guid.NewGuid();
        c.Contratos.SemearPagamento(new Pagamento
        {
            Id = id,
            ContratoId = contratoId,
            ReferenteMedicaoId = medicaoId,
            Valor = valor,
            DataPagamento = data,
            FormaPagamento = forma,
            CreatedAt = DateTime.UtcNow.AddMinutes(-criadoHaMinutos)
        });
        return id;
    }

    private static async Task<Guid> SemearMedicaoAsync(
        Cenario c, MedicaoStatus status, int numero = 1, Guid? obraId = null)
    {
        var id = Guid.NewGuid();
        await c.Medicoes.CreateAsync(new Medicao
        {
            Id = id,
            ObraId = obraId ?? ObraId,
            Numero = numero,
            Competencia = new DateOnly(2026, 10, 1),
            ValorTotal = 5000m,
            Status = status,
            NfNumber = status == MedicaoStatus.InvoiceIssued ? "NF-1" : null,
            NfIssuedAt = status == MedicaoStatus.InvoiceIssued ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
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

    private static object CorpoContrato(
        Guid? obraId = null, string numero = "CT-001", decimal valorContratado = 10_000m, string? dataAssinatura = "2026-03-15") =>
        new { obraId = obraId ?? ObraId, numero, valorContratado, dataAssinatura };

    private static object CorpoPagamento(
        decimal valor = 1_000m, string? dataPagamento = null, string? formaPagamento = "PIX", Guid? referenteMedicaoId = null) =>
        new { valor, dataPagamento = dataPagamento ?? Data(Hoje), formaPagamento, referenteMedicaoId };

    // ===== Visao do cliente: DTO reduzido, totais e saldo =====

    [Fact]
    public async Task Cliente_le_a_lista_reduzida_sem_storage_key_nem_campos_internos()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c, valor: 10_000m);
        SemearPagamento(c, contratoId, 3_000m, new DateOnly(2026, 4, 1));
        SemearPagamento(c, contratoId, 2_500.50m, new DateOnly(2026, 5, 1));

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.ClienteId);
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Array, json.ValueKind);
        var item = Assert.Single(json.EnumerateArray());
        Assert.Equal(contratoId, item.GetProperty("id").GetGuid());
        Assert.Equal(ObraId, item.GetProperty("obraId").GetGuid());
        Assert.Equal("CT-001", item.GetProperty("numero").GetString());
        Assert.Equal(10_000m, item.GetProperty("valorContratado").GetDecimal());
        Assert.Equal("2026-03-15", item.GetProperty("dataAssinatura").GetString());
        Assert.Equal(5_500.50m, item.GetProperty("totalPago").GetDecimal());
        Assert.Equal(4_499.50m, item.GetProperty("saldoAPagar").GetDecimal());

        foreach (var campo in new[] { "storageKey", "storage_key", "createdAt", "updatedAt", "pagamentos" })
        {
            Assert.False(item.TryGetProperty(campo, out _), campo);
        }

        Assert.DoesNotContain(ChaveInterna, texto);
    }

    [Fact]
    public async Task Resposta_do_cliente_nunca_traz_custo_real_ou_margem()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        SemearPagamento(c, contratoId, 1_000m, new DateOnly(2026, 4, 1));

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.ClienteId);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", UserRole.Client, c.ClienteId);

        foreach (var response in new[] { lista, detalhe })
        {
            var texto = (await response.Content.ReadAsStringAsync()).ToLowerInvariant();
            Assert.DoesNotContain("custo", texto);
            Assert.DoesNotContain("margem", texto);
            Assert.DoesNotContain("rentabilidade", texto);
        }
    }

    [Fact]
    public async Task Contrato_sem_pagamentos_tem_total_zero_e_saldo_igual_ao_valor_contratado()
    {
        var c = await CriarCenarioAsync();
        await SemearContratoAsync(c, valor: 7_777.77m);

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.ClienteId);
        var item = (await JsonAsync(response))[0];

        Assert.Equal(0m, item.GetProperty("totalPago").GetDecimal());
        Assert.Equal(7_777.77m, item.GetProperty("saldoAPagar").GetDecimal());
    }

    [Fact]
    public async Task Pagamento_acima_do_contratado_nao_e_barrado_e_o_saldo_fica_negativo()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c, valor: 1_000m);
        SemearPagamento(c, contratoId, 1_000m, new DateOnly(2026, 4, 1));

        using var criado = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin, body: CorpoPagamento(valor: 250.25m));
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.ClienteId);
        var item = (await JsonAsync(lista))[0];

        Assert.Equal(HttpStatusCode.Created, criado.StatusCode);
        Assert.Equal(1_250.25m, item.GetProperty("totalPago").GetDecimal());
        Assert.Equal(-250.25m, item.GetProperty("saldoAPagar").GetDecimal());
    }

    [Fact]
    public async Task Lista_traz_so_os_contratos_da_obra_consultada()
    {
        var c = await CriarCenarioAsync();
        await SemearContratoAsync(c, numero: "CT-001");
        await SemearContratoAsync(c, numero: "CT-002", valor: 500m);
        await SemearContratoAsync(c, numero: "CT-001", obraId: OutraObraId);

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(2, json.GetArrayLength());
        Assert.All(json.EnumerateArray(), i => Assert.Equal(ObraId, i.GetProperty("obraId").GetGuid()));
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_veem_o_dto_completo_na_lista_e_no_detalhe(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        SemearPagamento(c, contratoId, 1_500m, new DateOnly(2026, 4, 1), medicaoId: null);

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", role);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", role);
        var item = (await JsonAsync(lista))[0];
        var det = await JsonAsync(detalhe);

        Assert.Equal(HttpStatusCode.OK, lista.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detalhe.StatusCode);
        foreach (var campo in new[] { "createdAt", "updatedAt", "totalPago", "saldoAPagar", "valorContratado", "obraId" })
        {
            Assert.True(item.TryGetProperty(campo, out _), campo);
            Assert.True(det.TryGetProperty(campo, out _), campo);
        }

        // A chave do bucket nao e exposta a ninguem no V1 (sem upload/download do documento).
        Assert.False(item.TryGetProperty("storageKey", out _));
        Assert.False(det.TryGetProperty("storageKey", out _));
        Assert.True(det.GetProperty("pagamentos")[0].TryGetProperty("createdAt", out _));
        Assert.True(det.GetProperty("pagamentos")[0].TryGetProperty("contratoId", out _));
    }

    // ===== Detalhe =====

    [Fact]
    public async Task Detalhe_do_cliente_traz_pagamentos_reduzidos_da_data_mais_recente_para_a_mais_antiga()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c, valor: 10_000m);
        var medicaoId = await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, numero: 4);
        SemearPagamento(c, contratoId, 100m, new DateOnly(2026, 4, 1), forma: "PIX");
        SemearPagamento(c, contratoId, 300m, new DateOnly(2026, 6, 1), forma: "TED", medicaoId: medicaoId);
        SemearPagamento(c, contratoId, 200m, new DateOnly(2026, 5, 1), forma: null);
        // Pagamento de OUTRO contrato nao entra.
        var outroContrato = await SemearContratoAsync(c, numero: "CT-002");
        SemearPagamento(c, outroContrato, 9_999m, new DateOnly(2026, 7, 1));

        using var response = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", UserRole.Client, c.ClienteId);
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(600m, json.GetProperty("totalPago").GetDecimal());
        Assert.Equal(9_400m, json.GetProperty("saldoAPagar").GetDecimal());
        var pagamentos = json.GetProperty("pagamentos");
        Assert.Equal(
            new[] { 300m, 200m, 100m },
            pagamentos.EnumerateArray().Select(p => p.GetProperty("valor").GetDecimal()).ToArray());
        Assert.Equal("2026-06-01", pagamentos[0].GetProperty("dataPagamento").GetString());
        Assert.Equal("TED", pagamentos[0].GetProperty("formaPagamento").GetString());
        Assert.Equal(medicaoId, pagamentos[0].GetProperty("referenteMedicaoId").GetGuid());
        Assert.Equal(4, pagamentos[0].GetProperty("referenteMedicaoNumero").GetInt32());
        Assert.Equal(JsonValueKind.Null, pagamentos[1].GetProperty("formaPagamento").ValueKind);

        Assert.False(json.TryGetProperty("storageKey", out _));
        Assert.False(json.TryGetProperty("createdAt", out _));
        Assert.False(pagamentos[0].TryGetProperty("contratoId", out _));
        Assert.False(pagamentos[0].TryGetProperty("createdAt", out _));
        Assert.DoesNotContain(ChaveInterna, texto);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    [InlineData(UserRole.Client)]
    public async Task Contrato_inexistente_retorna_404_no_detalhe(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/contratos/{Guid.NewGuid()}", role, c.ClienteId);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_na_lista_e_no_detalhe_sem_vazar_dados()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.OutroClienteId);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, lista.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, detalhe.StatusCode);
        Assert.DoesNotContain("CT-001", await lista.Content.ReadAsStringAsync());
        Assert.DoesNotContain("CT-001", await detalhe.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Anonimo_recebe_401_nas_leituras_e_nas_escritas()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", null);
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", null);
        using var criar = await SendAsync(c, HttpMethod.Post, "/contratos", null, body: CorpoContrato());
        using var pagar = await SendAsync(c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", null, body: CorpoPagamento());

        Assert.Equal(HttpStatusCode.Unauthorized, lista.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, detalhe.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, criar.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, pagar.StatusCode);
    }

    // ===== Cliente e somente leitura =====

    [Fact]
    public async Task Cliente_nao_cria_contrato_nem_pagamento_e_recebe_403_antes_de_validar_o_corpo()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var contratoValido = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Client, c.ClienteId, CorpoContrato(numero: "CT-NOVO"));
        using var contratoInvalido = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Client, c.ClienteId, CorpoContrato(numero: ""));
        using var pagamentoValido = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Client, c.ClienteId, CorpoPagamento());
        using var pagamentoInvalido = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Client, c.ClienteId, CorpoPagamento(valor: 0m));

        Assert.Equal(HttpStatusCode.Forbidden, contratoValido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, contratoInvalido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, pagamentoValido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, pagamentoInvalido.StatusCode);
        Assert.Single(c.Contratos.Contratos);
        Assert.Empty(c.Contratos.Pagamentos);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== Criar contrato =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_criam_contrato_com_location_e_auditoria(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/contratos", role, atorId, CorpoContrato(numero: "  CT-2026/01  ", valorContratado: 125_000.55m));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal($"/contratos/{id}", response.Headers.Location?.OriginalString);
        Assert.Equal("CT-2026/01", json.GetProperty("numero").GetString());
        Assert.Equal(125_000.55m, json.GetProperty("valorContratado").GetDecimal());
        Assert.Equal(0m, json.GetProperty("totalPago").GetDecimal());
        Assert.Equal(125_000.55m, json.GetProperty("saldoAPagar").GetDecimal());
        Assert.Equal("2026-03-15", json.GetProperty("dataAssinatura").GetString());

        var salvo = Assert.Single(c.Contratos.Contratos);
        Assert.Equal(ObraId, salvo.ObraId);
        Assert.Equal("CT-2026/01", salvo.Numero);
        Assert.Null(salvo.StorageKey);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("contrato_criado", log.Acao);
        Assert.Equal("contrato", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains(ObraId.ToString(), log.Detalhes);
        Assert.Contains("\"numero\":\"CT-2026/01\"", log.Detalhes);
        Assert.Contains("\"valorContratado\":125000.55", log.Detalhes);
    }

    [Fact]
    public async Task Data_de_assinatura_e_opcional()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(dataAssinatura: null));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("dataAssinatura").ValueKind);
    }

    [Fact]
    public async Task Numero_repetido_na_mesma_obra_retorna_409_e_em_outra_obra_e_aceito()
    {
        var c = await CriarCenarioAsync();
        await SemearContratoAsync(c, numero: "CT-001");

        using var repetido = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(numero: "CT-001"));
        using var repetidoComEspacos = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(numero: " CT-001 "));
        using var outraObra = await SendAsync(
            c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(obraId: OutraObraId, numero: "CT-001"));

        Assert.Equal(HttpStatusCode.Conflict, repetido.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, repetidoComEspacos.StatusCode);
        Assert.Equal(HttpStatusCode.Created, outraObra.StatusCode);
        Assert.Equal(2, c.Contratos.Contratos.Count);
        // So o contrato aceito (outra obra) gerou auditoria; os 409 nao gravam nada.
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Corrida_pelo_numero_vira_409_pela_unique_do_banco()
    {
        var c = await CriarCenarioAsync();
        await SemearContratoAsync(c, numero: "CT-001");
        c.Contratos.SimularCorridaNoNumero = true;

        using var response = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(numero: "CT-001"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Single(c.Contratos.Contratos);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Criar_para_obra_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(obraId: Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Contratos.Contratos);
    }

    public static IEnumerable<object[]> ContratosInvalidos() =>
    [
        [CorpoContrato(obraId: Guid.Empty)],
        [CorpoContrato(numero: "")],
        [CorpoContrato(numero: "   ")],
        [CorpoContrato(numero: new string('x', 51))],
        [CorpoContrato(numero: "CT\n1")],
        [CorpoContrato(valorContratado: 0m)],
        [CorpoContrato(valorContratado: -10m)],
        [CorpoContrato(valorContratado: 100.123m)],
        [CorpoContrato(valorContratado: 1_000_000_000_000m)],
        [CorpoContrato(dataAssinatura: "1999-12-31")],
        [CorpoContrato(dataAssinatura: "2101-01-01")]
    ];

    [Theory]
    [MemberData(nameof(ContratosInvalidos))]
    public async Task Contrato_com_corpo_invalido_retorna_400_com_errors_e_nada_e_gravado(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/contratos", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        Assert.Empty(c.Contratos.Contratos);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Contrato_com_numero_de_50_caracteres_e_valor_maximo_e_aceito()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/contratos", UserRole.Admin,
            body: CorpoContrato(numero: new string('9', 50), valorContratado: 999_999_999_999.99m));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    // ===== Registrar pagamento =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_registram_pagamento_com_auditoria(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        var atorId = Guid.NewGuid();

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", role, atorId,
            CorpoPagamento(valor: 2_500.75m, dataPagamento: "2026-10-10", formaPagamento: "  PIX  "));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal($"/contratos/{contratoId}", response.Headers.Location?.OriginalString);
        var id = json.GetProperty("id").GetGuid();
        Assert.Equal(contratoId, json.GetProperty("contratoId").GetGuid());
        Assert.Equal(2_500.75m, json.GetProperty("valor").GetDecimal());
        Assert.Equal("2026-10-10", json.GetProperty("dataPagamento").GetString());
        Assert.Equal("PIX", json.GetProperty("formaPagamento").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("referenteMedicaoId").ValueKind);

        var salvo = Assert.Single(c.Contratos.Pagamentos);
        Assert.Equal(id, salvo.Id);
        Assert.Equal("PIX", salvo.FormaPagamento);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("pagamento_registrado", log.Acao);
        Assert.Equal("pagamento", log.Entidade);
        Assert.Equal(id, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains(ObraId.ToString(), log.Detalhes);
        Assert.Contains(contratoId.ToString(), log.Detalhes);
        Assert.Contains("\"valor\":2500.75", log.Detalhes);
        Assert.DoesNotContain("PIX", log.Detalhes);
    }

    [Fact]
    public async Task Forma_de_pagamento_em_branco_ou_ausente_e_gravada_como_nula()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var emBranco = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin, body: CorpoPagamento(formaPagamento: "   "));
        using var ausente = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin, body: CorpoPagamento(formaPagamento: null));

        Assert.Equal(HttpStatusCode.Created, emBranco.StatusCode);
        Assert.Equal(HttpStatusCode.Created, ausente.StatusCode);
        Assert.All(c.Contratos.Pagamentos, p => Assert.Null(p.FormaPagamento));
    }

    [Fact]
    public async Task Pagamento_vinculado_a_medicao_da_mesma_obra_com_nf_e_aceito_e_mostra_o_numero_da_medicao()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        var medicaoId = await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, numero: 7);

        using var response = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(referenteMedicaoId: medicaoId));
        using var detalhe = await SendAsync(c, HttpMethod.Get, $"/contratos/{contratoId}", UserRole.Admin);
        var pagamento = (await JsonAsync(detalhe)).GetProperty("pagamentos")[0];

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(medicaoId, (await JsonAsync(response)).GetProperty("referenteMedicaoId").GetGuid());
        Assert.Equal(medicaoId, pagamento.GetProperty("referenteMedicaoId").GetGuid());
        Assert.Equal(7, pagamento.GetProperty("referenteMedicaoNumero").GetInt32());

        var log = Assert.Single(c.Logs.Logs);
        Assert.Contains(medicaoId.ToString(), log.Detalhes);
    }

    [Fact]
    public async Task Duas_parcelas_da_mesma_medicao_sao_aceitas()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        var medicaoId = await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued);

        using var primeira = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(valor: 2_000m, referenteMedicaoId: medicaoId));
        using var segunda = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(valor: 3_000m, referenteMedicaoId: medicaoId));

        Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.Created, segunda.StatusCode);
    }

    [Fact]
    public async Task Medicao_de_outra_obra_inexistente_ou_sem_nf_retorna_400_com_a_mesma_mensagem_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        var deOutraObra = await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, numero: 1, obraId: OutraObraId);
        var pendente = await SemearMedicaoAsync(c, MedicaoStatus.PendingApproval, numero: 2);
        var aprovada = await SemearMedicaoAsync(c, MedicaoStatus.Approved, numero: 3);

        var mensagens = new List<string>();
        foreach (var medicaoId in new[] { deOutraObra, pendente, aprovada, Guid.NewGuid() })
        {
            using var response = await SendAsync(
                c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
                body: CorpoPagamento(referenteMedicaoId: medicaoId));
            var json = await JsonAsync(response);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var erros = json.GetProperty("errors").GetProperty("ReferenteMedicaoId");
            mensagens.Add(erros[0].GetString()!);
        }

        // Inexistente, de outra obra e sem NF sao indistinguiveis para quem chama.
        Assert.Single(mensagens.Distinct());
        Assert.Empty(c.Contratos.Pagamentos);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Pagamento_em_contrato_inexistente_retorna_404_mesmo_com_corpo_invalido()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{Guid.NewGuid()}/pagamentos", UserRole.Admin, body: CorpoPagamento());
        using var invalido = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{Guid.NewGuid()}/pagamentos", UserRole.Master, body: CorpoPagamento(valor: 0m));

        Assert.Equal(HttpStatusCode.NotFound, valido.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, invalido.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    public static IEnumerable<object[]> PagamentosInvalidos() =>
    [
        [CorpoPagamento(valor: 0m)],
        [CorpoPagamento(valor: -1m)],
        [CorpoPagamento(valor: 10.123m)],
        [CorpoPagamento(valor: 1_000_000_000_000m)],
        [CorpoPagamento(dataPagamento: "0001-01-01")],
        [CorpoPagamento(dataPagamento: "1999-12-31")],
        [CorpoPagamento(dataPagamento: "2099-01-01")],
        [CorpoPagamento(formaPagamento: new string('x', 51))],
        [CorpoPagamento(formaPagamento: "PIX\n")],
        [CorpoPagamento(referenteMedicaoId: Guid.Empty)]
    ];

    [Theory]
    [MemberData(nameof(PagamentosInvalidos))]
    public async Task Pagamento_com_corpo_invalido_retorna_400_com_errors_e_nada_e_gravado(object corpo)
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var response = await SendAsync(c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        Assert.Empty(c.Contratos.Pagamentos);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Data_do_pagamento_aceita_ate_hoje_mais_um_dia_e_recusa_alem_disso()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);

        using var amanha = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(dataPagamento: Data(Hoje.AddDays(1))));
        using var depoisDeAmanha = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(dataPagamento: Data(Hoje.AddDays(3))));

        Assert.Equal(HttpStatusCode.Created, amanha.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, depoisDeAmanha.StatusCode);
    }

    // ===== Repositorio e fluxo: tudo preso a obra =====

    [Fact]
    public async Task Consultas_e_gravacao_do_repositorio_sao_presas_a_obra()
    {
        var c = await CriarCenarioAsync();
        var contratoId = await SemearContratoAsync(c);
        SemearPagamento(c, contratoId, 100m, new DateOnly(2026, 4, 1));

        Assert.Null(await c.Contratos.GetByIdAndObraAsync(contratoId, OutraObraId));
        Assert.Empty(await c.Contratos.GetPagamentosAsync(contratoId, OutraObraId));
        Assert.Empty(await c.Contratos.GetByObraIdAsync(OutraObraId));
        Assert.False(await c.Contratos.CreatePagamentoAsync(
            new Pagamento { Id = Guid.NewGuid(), ContratoId = contratoId, Valor = 1m, DataPagamento = Hoje, CreatedAt = DateTime.UtcNow },
            OutraObraId));
        Assert.Single(c.Contratos.Pagamentos);
    }

    [Fact]
    public async Task Fluxo_completo_cria_contrato_registra_pagamento_e_a_lista_do_cliente_reflete_o_saldo()
    {
        var c = await CriarCenarioAsync();
        var medicaoId = await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued);

        using var criado = await SendAsync(
            c, HttpMethod.Post, "/contratos", UserRole.Admin, body: CorpoContrato(valorContratado: 20_000m));
        var contratoId = (await JsonAsync(criado)).GetProperty("id").GetGuid();
        using var pago = await SendAsync(
            c, HttpMethod.Post, $"/contratos/{contratoId}/pagamentos", UserRole.Admin,
            body: CorpoPagamento(valor: 5_000m, referenteMedicaoId: medicaoId));
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{ObraId}/contratos", UserRole.Client, c.ClienteId);
        var item = (await JsonAsync(lista))[0];

        Assert.Equal(HttpStatusCode.Created, criado.StatusCode);
        Assert.Equal(HttpStatusCode.Created, pago.StatusCode);
        Assert.Equal(5_000m, item.GetProperty("totalPago").GetDecimal());
        Assert.Equal(15_000m, item.GetProperty("saldoAPagar").GetDecimal());
        Assert.Equal(
            new[] { "contrato_criado", "pagamento_registrado" },
            c.Logs.Logs.Select(l => l.Acao).ToArray());
    }
}
