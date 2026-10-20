using KhazObras.Application.Dtos.Contratos;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

public sealed class ContratoValidatorTests
{
    private readonly CreateContratoRequestValidator _contrato = new();
    private readonly CreatePagamentoRequestValidator _pagamento = new();

    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);

    private static CreateContratoRequest Contrato(
        string numero = "CT-001", decimal valor = 1_000m, DateOnly? assinatura = null, Guid? obraId = null) =>
        new(obraId ?? Guid.NewGuid(), numero, valor, assinatura);

    private static CreatePagamentoRequest Pagamento(
        decimal valor = 100m, DateOnly? data = null, string? forma = "PIX", Guid? medicaoId = null) =>
        new(valor, data ?? Hoje, forma, medicaoId);

    // ===== Contrato =====

    [Fact]
    public async Task Contrato_valido_com_e_sem_data_de_assinatura_passa()
    {
        Assert.True((await _contrato.ValidateAsync(Contrato())).IsValid);
        Assert.True((await _contrato.ValidateAsync(Contrato(assinatura: new DateOnly(2026, 3, 15)))).IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Numero_de_contrato_vazio_ou_nulo_e_invalido_sem_lancar_excecao(string? numero)
    {
        var result = await _contrato.ValidateAsync(Contrato(numero: numero!));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Numero");
    }

    [Fact]
    public async Task Numero_de_contrato_aceita_50_e_recusa_51_caracteres_e_controle()
    {
        Assert.True((await _contrato.ValidateAsync(Contrato(numero: new string('1', 50)))).IsValid);
        Assert.False((await _contrato.ValidateAsync(Contrato(numero: new string('1', 51)))).IsValid);
        Assert.False((await _contrato.ValidateAsync(Contrato(numero: "CT\t1"))).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(10.123)]
    public async Task Valor_contratado_zero_negativo_ou_com_mais_de_duas_casas_e_invalido(double valor)
    {
        var result = await _contrato.ValidateAsync(Contrato(valor: (decimal)valor));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ValorContratado");
    }

    [Fact]
    public async Task Valor_contratado_respeita_o_limite_do_numeric_14_2()
    {
        Assert.True((await _contrato.ValidateAsync(Contrato(valor: 0.01m))).IsValid);
        Assert.True((await _contrato.ValidateAsync(Contrato(valor: 999_999_999_999.99m))).IsValid);
        Assert.False((await _contrato.ValidateAsync(Contrato(valor: 1_000_000_000_000m))).IsValid);
    }

    [Fact]
    public async Task Data_de_assinatura_fora_de_2000_a_2100_e_invalida()
    {
        Assert.False((await _contrato.ValidateAsync(Contrato(assinatura: new DateOnly(1999, 12, 31)))).IsValid);
        Assert.False((await _contrato.ValidateAsync(Contrato(assinatura: new DateOnly(2101, 1, 1)))).IsValid);
    }

    [Fact]
    public async Task Obra_vazia_e_pedido_todo_zerado_sao_invalidos_sem_lancar_excecao()
    {
        Assert.False((await _contrato.ValidateAsync(Contrato(obraId: Guid.Empty))).IsValid);
        Assert.False((await _contrato.ValidateAsync(new CreateContratoRequest(Guid.Empty, null!, 0m, null))).IsValid);
    }

    // ===== Pagamento =====

    [Fact]
    public async Task Pagamento_valido_com_e_sem_forma_e_medicao_passa()
    {
        Assert.True((await _pagamento.ValidateAsync(Pagamento())).IsValid);
        Assert.True((await _pagamento.ValidateAsync(Pagamento(forma: null))).IsValid);
        Assert.True((await _pagamento.ValidateAsync(Pagamento(forma: "  "))).IsValid);
        Assert.True((await _pagamento.ValidateAsync(Pagamento(medicaoId: Guid.NewGuid()))).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1.005)]
    public async Task Valor_do_pagamento_zero_negativo_ou_com_mais_de_duas_casas_e_invalido(double valor)
    {
        var result = await _pagamento.ValidateAsync(Pagamento(valor: (decimal)valor));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Valor");
    }

    [Fact]
    public async Task Valor_do_pagamento_respeita_o_limite_do_numeric_14_2()
    {
        Assert.True((await _pagamento.ValidateAsync(Pagamento(valor: 999_999_999_999.99m))).IsValid);
        Assert.False((await _pagamento.ValidateAsync(Pagamento(valor: 1_000_000_000_000m))).IsValid);
    }

    [Fact]
    public async Task Data_do_pagamento_aceita_hoje_e_amanha_e_recusa_futuro_distante_e_data_zerada()
    {
        Assert.True((await _pagamento.ValidateAsync(Pagamento(data: Hoje))).IsValid);
        Assert.True((await _pagamento.ValidateAsync(Pagamento(data: Hoje.AddDays(1)))).IsValid);
        Assert.True((await _pagamento.ValidateAsync(Pagamento(data: new DateOnly(2000, 1, 1)))).IsValid);

        Assert.False((await _pagamento.ValidateAsync(Pagamento(data: Hoje.AddDays(3)))).IsValid);
        Assert.False((await _pagamento.ValidateAsync(Pagamento(data: new DateOnly(1999, 12, 31)))).IsValid);
        Assert.False((await _pagamento.ValidateAsync(Pagamento(data: default(DateOnly)))).IsValid);
    }

    [Fact]
    public async Task Forma_de_pagamento_aceita_50_e_recusa_51_caracteres_e_controle()
    {
        Assert.True((await _pagamento.ValidateAsync(Pagamento(forma: new string('a', 50)))).IsValid);
        Assert.False((await _pagamento.ValidateAsync(Pagamento(forma: new string('a', 51)))).IsValid);
        Assert.False((await _pagamento.ValidateAsync(Pagamento(forma: "PIX\r\n"))).IsValid);
    }

    [Fact]
    public async Task Medicao_vinculada_com_guid_vazio_e_invalida()
    {
        var result = await _pagamento.ValidateAsync(Pagamento(medicaoId: Guid.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ReferenteMedicaoId");
    }
}
