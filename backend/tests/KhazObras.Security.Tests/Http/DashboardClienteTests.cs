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
/// GET /obras/{obraId}/dashboard, pipeline HTTP real com repositorios em memoria: DTO unico e seguro para o cliente
/// (so valores contratados/medidos aprovados; nunca custo real, margem, peso ou ids de usuario), padrao de acesso
/// (EnsureAccessAsync -> 403; obra inexistente -> 404) e calculos feitos no servidor (avanco ponderado, prazo com
/// relogio fixo, valor restante, acumulado por mes).
/// </summary>
public sealed class DashboardClienteTests : IClassFixture<ApiFactory>
{
    private static readonly Guid ObraId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OutraObraId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    // 2026-10-20 15:00 UTC = 12:00 em Sao Paulo: "hoje" do cliente e 2026-10-20.
    private static readonly DateTimeOffset AgoraPadrao = new(2026, 10, 20, 15, 0, 0, TimeSpan.Zero);

    private readonly ApiFactory _factory;

    public DashboardClienteTests(ApiFactory factory) => _factory = factory;

    private sealed class RelogioFixo : TimeProvider
    {
        private readonly DateTimeOffset _agora;

        public RelogioFixo(DateTimeOffset agora) => _agora = agora;

        public override DateTimeOffset GetUtcNow() => _agora;
    }

    private sealed record Cenario(
        HttpClient Client,
        FakeObraRepository Obras,
        FakeEtapaRepository Etapas,
        FakeMedicaoRepository Medicoes,
        FakeContratoRepository Contratos,
        FakeFinanceiroRepository Financeiro,
        FakeDashboardClienteRepository Dashboard,
        Guid ClienteId,
        Guid OutroClienteId);

    private async Task<Cenario> CriarCenarioAsync(
        DateTimeOffset? agora = null,
        decimal valorContratado = 100_000m,
        DateOnly? dataInicio = null,
        DateOnly? dataPrevisao = null,
        bool semDatas = false)
    {
        var obras = new FakeObraRepository();
        var etapas = new FakeEtapaRepository();
        var medicoes = new FakeMedicaoRepository();
        var contratos = new FakeContratoRepository(medicoes);
        var financeiro = new FakeFinanceiroRepository();
        var dashboard = new FakeDashboardClienteRepository(obras, etapas, medicoes, contratos);
        var vinculos = new FakeUserObraRepository();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, ObraId);
        await vinculos.LinkAsync(outroClienteId, OutraObraId);

        await obras.CreateAsync(new Obra
        {
            Id = ObraId,
            Nome = "Residencial Aurora",
            ValorContratado = valorContratado,
            DataInicio = semDatas ? null : dataInicio ?? new DateOnly(2026, 1, 10),
            DataPrevisaoTermino = semDatas ? null : dataPrevisao ?? new DateOnly(2026, 12, 31),
            Status = ObraStatus.EmAndamento,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await obras.CreateAsync(new Obra
        {
            Id = OutraObraId,
            Nome = "Edificio Horizonte",
            ValorContratado = 555_000m,
            DataPrevisaoTermino = new DateOnly(2027, 6, 30),
            Status = ObraStatus.EmAndamento,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        var relogio = new RelogioFixo(agora ?? AgoraPadrao);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IDashboardClienteRepository>(dashboard);
                services.AddSingleton<IFinanceiroLancamentoRepository>(financeiro);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<TimeProvider>(relogio);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, obras, etapas, medicoes, contratos, financeiro, dashboard, clienteId, outroClienteId);
    }

    private static async Task SemearEtapaAsync(
        Cenario c, string nome, int ordem, decimal concluido, decimal peso, Guid? obraId = null,
        string status = "em_andamento", DateOnly? inicio = null, DateOnly? fim = null) =>
        await c.Etapas.CreateAsync(new Etapa
        {
            Id = Guid.NewGuid(),
            ObraId = obraId ?? ObraId,
            Nome = nome,
            Ordem = ordem,
            PercentualConcluido = concluido,
            PercentualPeso = peso,
            Status = status,
            DataInicioPrevista = inicio,
            DataFimPrevista = fim,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

    private static int _numeroMedicao;

    private static async Task SemearMedicaoAsync(
        Cenario c, MedicaoStatus status, decimal valor, DateOnly competencia, Guid? obraId = null, Guid? aprovadaPor = null) =>
        await c.Medicoes.CreateAsync(new Medicao
        {
            Id = Guid.NewGuid(),
            ObraId = obraId ?? ObraId,
            Numero = Interlocked.Increment(ref _numeroMedicao),
            Competencia = competencia,
            ValorTotal = valor,
            Status = status,
            ApprovedAt = status == MedicaoStatus.PendingApproval ? null : DateTime.UtcNow,
            ApprovedByUserId = status == MedicaoStatus.PendingApproval ? null : aprovadaPor,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

    private static async Task<Guid> SemearContratoComPagamentoAsync(Cenario c, string numero, decimal pago, Guid? obraId = null)
    {
        var contratoId = Guid.NewGuid();
        await c.Contratos.CreateAsync(new Contrato
        {
            Id = contratoId,
            ObraId = obraId ?? ObraId,
            Numero = numero,
            ValorContratado = 80_000m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        c.Contratos.SemearPagamento(new Pagamento
        {
            Id = Guid.NewGuid(),
            ContratoId = contratoId,
            Valor = pago,
            DataPagamento = new DateOnly(2026, 9, 1),
            CreatedAt = DateTime.UtcNow
        });
        return contratoId;
    }

    private static async Task<HttpResponseMessage> GetDashboardAsync(
        Cenario c, UserRole? role, Guid? userId = null, Guid? obraId = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"/obras/{obraId ?? ObraId}/dashboard");
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    // ===== Acesso =====

    [Fact]
    public async Task Cliente_da_obra_recebe_o_dashboard_completo()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "Fundacao", 1, 100m, 40m, inicio: new DateOnly(2026, 2, 1), fim: new DateOnly(2026, 3, 15));
        await SemearEtapaAsync(c, "Estrutura", 2, 50m, 60m, status: "em_andamento");
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 30_000m, new DateOnly(2026, 8, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, 20_000m, new DateOnly(2026, 10, 1));
        await SemearContratoComPagamentoAsync(c, "CT-001", 12_000m);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, c.Dashboard.Chamadas);

        var obra = json.GetProperty("obra");
        Assert.Equal(ObraId, obra.GetProperty("id").GetGuid());
        Assert.Equal("Residencial Aurora", obra.GetProperty("nome").GetString());
        Assert.Equal("2026-01-10", obra.GetProperty("dataInicio").GetString());
        Assert.Equal("2026-12-31", obra.GetProperty("dataPrevisaoTermino").GetString());
        Assert.Equal("EmAndamento", obra.GetProperty("status").GetString());

        // (100 x 40 + 50 x 60) / 100 = 70,0
        Assert.Equal(70.0m, json.GetProperty("avancoFisicoPercentual").GetDecimal());

        var prazo = json.GetProperty("prazo");
        Assert.Equal(72, prazo.GetProperty("diasRestantes").GetInt32());
        Assert.Equal("2026-12-31", prazo.GetProperty("dataPrevisaoTermino").GetString());

        var valores = json.GetProperty("valores");
        Assert.Equal(100_000m, valores.GetProperty("valorContratado").GetDecimal());
        Assert.Equal(50_000m, valores.GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal(50_000m, valores.GetProperty("valorRestante").GetDecimal());
        Assert.Equal(12_000m, valores.GetProperty("totalPago").GetDecimal());

        var etapas = json.GetProperty("avancoPorEtapa");
        Assert.Equal(2, etapas.GetArrayLength());
        Assert.Equal("Fundacao", etapas[0].GetProperty("nome").GetString());
        Assert.Equal(1, etapas[0].GetProperty("ordem").GetInt32());
        Assert.Equal(100m, etapas[0].GetProperty("percentualConcluido").GetDecimal());
        Assert.Equal("em_andamento", etapas[0].GetProperty("status").GetString());
        Assert.Equal("2026-02-01", etapas[0].GetProperty("dataInicioPrevista").GetString());
        Assert.Equal("2026-03-15", etapas[0].GetProperty("dataFimPrevista").GetString());
        Assert.NotEqual(Guid.Empty, etapas[0].GetProperty("etapaId").GetGuid());
        Assert.Equal(JsonValueKind.Null, etapas[1].GetProperty("dataInicioPrevista").ValueKind);

        var meses = json.GetProperty("medidoPorMes");
        Assert.Equal(2, meses.GetArrayLength());
        Assert.Equal("2026-08-01", meses[0].GetProperty("competencia").GetString());
        Assert.Equal(30_000m, meses[0].GetProperty("valorMedido").GetDecimal());
        Assert.Equal(30_000m, meses[0].GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal("2026-10-01", meses[1].GetProperty("competencia").GetString());
        Assert.Equal(20_000m, meses[1].GetProperty("valorMedido").GetDecimal());
        Assert.Equal(50_000m, meses[1].GetProperty("valorMedidoAcumulado").GetDecimal());
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_sem_vazar_dados()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "Fundacao", 1, 100m, 40m);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.OutroClienteId);
        var texto = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.DoesNotContain("Residencial Aurora", texto);
        Assert.Equal(0, c.Dashboard.Chamadas);
    }

    [Fact]
    public async Task Anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetDashboardAsync(c, null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, c.Dashboard.Chamadas);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Obra_inexistente_retorna_404_para_admin_e_master(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await GetDashboardAsync(c, role, obraId: Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_em_obra_inexistente_recebe_403_e_nao_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, c.Dashboard.Chamadas);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Admin_e_master_recebem_exatamente_o_mesmo_dto_do_cliente(UserRole role)
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "Fundacao", 1, 80m, 50m);
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 10_000m, new DateOnly(2026, 9, 1));
        await SemearContratoComPagamentoAsync(c, "CT-001", 4_000m);

        using var doCliente = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        using var doAdmin = await GetDashboardAsync(c, role);

        Assert.Equal(HttpStatusCode.OK, doAdmin.StatusCode);
        Assert.Equal(await doCliente.Content.ReadAsStringAsync(), await doAdmin.Content.ReadAsStringAsync());
    }

    // ===== Visao segura: nada interno no JSON =====

    [Fact]
    public async Task Json_do_cliente_nao_traz_custo_margem_peso_chaves_ids_de_usuario_nem_lancamentos_do_financeiro()
    {
        var c = await CriarCenarioAsync();
        var aprovador = Guid.NewGuid();
        await SemearEtapaAsync(c, "Fundacao", 1, 100m, 40m);
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 30_000m, new DateOnly(2026, 8, 1), aprovadaPor: aprovador);
        await SemearContratoComPagamentoAsync(c, "CT-001", 12_000m);
        await c.Financeiro.CreateAsync(new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = ObraId,
            Categoria = ItemTipo.Material,
            Descricao = "Cimento do lancamento interno",
            Valor = 98_765.43m,
            DataLancamento = new DateOnly(2026, 9, 5),
            MesCompetencia = new DateOnly(2026, 9, 1),
            CreatedByUserId = aprovador,
            VisivelCliente = true,
            CreatedAt = DateTime.UtcNow
        });

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var texto = await response.Content.ReadAsStringAsync();
        var minusculo = texto.ToLowerInvariant();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        foreach (var proibido in new[] { "custo", "margem", "rentabilidade", "peso", "storagekey", "storage_key", "approvedby", "createdby", "userid" })
        {
            Assert.DoesNotContain(proibido, minusculo);
        }

        Assert.DoesNotContain(aprovador.ToString(), texto);
        Assert.DoesNotContain(c.ClienteId.ToString(), texto);
        Assert.DoesNotContain("98765.43", texto);
        Assert.DoesNotContain("Cimento", texto);

        // Contrato exato de chaves: nada alem do combinado com o front.
        var json = JsonDocument.Parse(texto).RootElement;
        Assert.Equal(
            new[] { "avancoFisicoPercentual", "avancoPorEtapa", "medidoPorMes", "obra", "prazo", "valores" },
            json.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray());
        Assert.Equal(
            new[] { "etapaId", "nome", "ordem", "percentualConcluido", "status", "dataInicioPrevista", "dataFimPrevista" }.Order().ToArray(),
            json.GetProperty("avancoPorEtapa")[0].EnumerateObject().Select(p => p.Name).Order().ToArray());
        Assert.Equal(
            new[] { "valorContratado", "valorMedidoAcumulado", "valorRestante", "totalPago" }.Order().ToArray(),
            json.GetProperty("valores").EnumerateObject().Select(p => p.Name).Order().ToArray());
    }

    // ===== Avanco fisico =====

    [Fact]
    public async Task Avanco_fisico_e_ponderado_pelo_peso_com_uma_casa_decimal()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "A", 1, 10m, 1m);
        await SemearEtapaAsync(c, "B", 2, 20m, 2m);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        // (10 x 1 + 20 x 2) / 3 = 16,666... -> 16,7
        Assert.Equal(16.7m, (await JsonAsync(response)).GetProperty("avancoFisicoPercentual").GetDecimal());
    }

    [Fact]
    public async Task Avanco_fisico_cai_na_media_simples_quando_todos_os_pesos_sao_zero()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "A", 1, 10m, 0m);
        await SemearEtapaAsync(c, "B", 2, 25m, 0m);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(17.5m, (await JsonAsync(response)).GetProperty("avancoFisicoPercentual").GetDecimal());
    }

    [Fact]
    public async Task Etapa_com_peso_zero_nao_pesa_quando_ha_etapas_com_peso()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "A", 1, 100m, 0m);
        await SemearEtapaAsync(c, "B", 2, 40m, 10m);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(40.0m, (await JsonAsync(response)).GetProperty("avancoFisicoPercentual").GetDecimal());
    }

    [Fact]
    public async Task Obra_sem_etapas_tem_avanco_zero_e_listas_vazias()
    {
        var c = await CriarCenarioAsync();
        // Etapa de OUTRA obra nao conta.
        await SemearEtapaAsync(c, "Alheia", 1, 100m, 50m, obraId: OutraObraId);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);

        Assert.Equal(0m, json.GetProperty("avancoFisicoPercentual").GetDecimal());
        Assert.Equal(0, json.GetProperty("avancoPorEtapa").GetArrayLength());
        Assert.Equal(0, json.GetProperty("medidoPorMes").GetArrayLength());
        Assert.Equal(0m, json.GetProperty("valores").GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal(0m, json.GetProperty("valores").GetProperty("totalPago").GetDecimal());
    }

    [Fact]
    public async Task Avanco_por_etapa_vem_ordenado_pela_ordem_e_so_com_etapas_da_obra()
    {
        var c = await CriarCenarioAsync();
        await SemearEtapaAsync(c, "Terceira", 3, 0m, 10m, status: "nao_iniciada");
        await SemearEtapaAsync(c, "Primeira", 1, 100m, 10m, status: "concluida");
        await SemearEtapaAsync(c, "Segunda", 2, 30m, 10m);
        await SemearEtapaAsync(c, "Alheia", 1, 100m, 10m, obraId: OutraObraId);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var etapas = (await JsonAsync(response)).GetProperty("avancoPorEtapa");

        Assert.Equal(
            new[] { "Primeira", "Segunda", "Terceira" },
            etapas.EnumerateArray().Select(e => e.GetProperty("nome").GetString()).ToArray());
        Assert.Equal("concluida", etapas[0].GetProperty("status").GetString());
        Assert.Equal("nao_iniciada", etapas[2].GetProperty("status").GetString());
    }

    // ===== Prazo (relogio fixo) =====

    [Fact]
    public async Task Prazo_futuro_conta_os_dias_restantes_a_partir_de_hoje_em_sao_paulo()
    {
        var c = await CriarCenarioAsync(dataPrevisao: new DateOnly(2026, 10, 30));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(10, (await JsonAsync(response)).GetProperty("prazo").GetProperty("diasRestantes").GetInt32());
    }

    [Fact]
    public async Task Prazo_vencido_fica_negativo()
    {
        var c = await CriarCenarioAsync(dataPrevisao: new DateOnly(2026, 10, 15));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(-5, (await JsonAsync(response)).GetProperty("prazo").GetProperty("diasRestantes").GetInt32());
    }

    [Fact]
    public async Task Prazo_no_proprio_dia_da_previsao_e_zero()
    {
        var c = await CriarCenarioAsync(dataPrevisao: new DateOnly(2026, 10, 20));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(0, (await JsonAsync(response)).GetProperty("prazo").GetProperty("diasRestantes").GetInt32());
    }

    [Fact]
    public async Task Prazo_usa_a_data_de_sao_paulo_e_nao_a_utc_de_madrugada()
    {
        // 2026-10-20 02:00 UTC ainda e 2026-10-19 23:00 em Sao Paulo: faltam 11 dias para 30/10, nao 10.
        var c = await CriarCenarioAsync(
            agora: new DateTimeOffset(2026, 10, 20, 2, 0, 0, TimeSpan.Zero),
            dataPrevisao: new DateOnly(2026, 10, 30));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(11, (await JsonAsync(response)).GetProperty("prazo").GetProperty("diasRestantes").GetInt32());
    }

    [Fact]
    public async Task Obra_sem_data_de_previsao_tem_dias_restantes_nulo()
    {
        var c = await CriarCenarioAsync(semDatas: true);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("prazo").GetProperty("diasRestantes").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("prazo").GetProperty("dataPrevisaoTermino").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.GetProperty("obra").GetProperty("dataInicio").ValueKind);
    }

    // ===== Valores =====

    [Fact]
    public async Task Medicoes_pendentes_e_de_outra_obra_nao_entram_no_acumulado()
    {
        var c = await CriarCenarioAsync(valorContratado: 100_000m);
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 30_000m, new DateOnly(2026, 8, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, 20_000m, new DateOnly(2026, 9, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.PendingApproval, 99_999m, new DateOnly(2026, 10, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 77_777m, new DateOnly(2026, 8, 1), obraId: OutraObraId);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);
        var valores = json.GetProperty("valores");

        Assert.Equal(50_000m, valores.GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal(50_000m, valores.GetProperty("valorRestante").GetDecimal());
        // O mes da medicao pendente nao aparece.
        Assert.Equal(
            new[] { "2026-08-01", "2026-09-01" },
            json.GetProperty("medidoPorMes").EnumerateArray().Select(m => m.GetProperty("competencia").GetString()).ToArray());
    }

    [Fact]
    public async Task Valor_restante_fica_negativo_quando_o_medido_passa_do_contratado()
    {
        var c = await CriarCenarioAsync(valorContratado: 10_000m);
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 15_000.50m, new DateOnly(2026, 9, 1));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var valores = (await JsonAsync(response)).GetProperty("valores");

        Assert.Equal(15_000.50m, valores.GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal(-5_000.50m, valores.GetProperty("valorRestante").GetDecimal());
    }

    [Fact]
    public async Task Total_pago_soma_so_os_pagamentos_dos_contratos_da_obra()
    {
        var c = await CriarCenarioAsync();
        await SemearContratoComPagamentoAsync(c, "CT-001", 1_000m);
        await SemearContratoComPagamentoAsync(c, "CT-002", 2_500.25m);
        await SemearContratoComPagamentoAsync(c, "CT-001", 9_999m, obraId: OutraObraId);

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);

        Assert.Equal(
            3_500.25m,
            (await JsonAsync(response)).GetProperty("valores").GetProperty("totalPago").GetDecimal());
    }

    // ===== Medido por mes =====

    [Fact]
    public async Task Medido_por_mes_soma_o_mes_acumula_em_ordem_crescente_e_pula_meses_sem_medicao()
    {
        var c = await CriarCenarioAsync();
        // Inseridas fora de ordem; duas no mesmo mes (competencia em dias diferentes) viram uma linha.
        await SemearMedicaoAsync(c, MedicaoStatus.InvoiceIssued, 7_000m, new DateOnly(2026, 10, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 1_000.10m, new DateOnly(2026, 7, 1));
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 2_000.20m, new DateOnly(2026, 7, 15));
        await SemearMedicaoAsync(c, MedicaoStatus.Approved, 500m, new DateOnly(2026, 9, 1));

        using var response = await GetDashboardAsync(c, UserRole.Client, c.ClienteId);
        var meses = (await JsonAsync(response)).GetProperty("medidoPorMes");

        Assert.Equal(3, meses.GetArrayLength());
        Assert.Equal("2026-07-01", meses[0].GetProperty("competencia").GetString());
        Assert.Equal(3_000.30m, meses[0].GetProperty("valorMedido").GetDecimal());
        Assert.Equal(3_000.30m, meses[0].GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal("2026-09-01", meses[1].GetProperty("competencia").GetString());
        Assert.Equal(500m, meses[1].GetProperty("valorMedido").GetDecimal());
        Assert.Equal(3_500.30m, meses[1].GetProperty("valorMedidoAcumulado").GetDecimal());
        Assert.Equal("2026-10-01", meses[2].GetProperty("competencia").GetString());
        Assert.Equal(10_500.30m, meses[2].GetProperty("valorMedidoAcumulado").GetDecimal());
    }
}
