using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

public sealed class MedicaoValidatorTests
{
    private readonly CreateMedicaoRequestValidator _criacao = new();
    private readonly IssueInvoiceRequestValidator _nf = new();

    private static CreateMedicaoRequest Pedido(params CreateMedicaoItemRequest?[] itens) => new(
        Guid.NewGuid(), null, 1, new DateOnly(2026, 10, 1), itens.ToList()!);

    [Fact]
    public async Task Item_nulo_na_lista_e_invalido_sem_lancar_excecao()
    {
        var result = await _criacao.ValidateAsync(Pedido(new CreateMedicaoItemRequest("material", "Cimento", 1m, 10m), null));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Pedido_sem_itens_nem_competencia_e_invalido_sem_lancar_excecao()
    {
        var pedido = new CreateMedicaoRequest(Guid.Empty, null, 0, default, null!);

        var result = await _criacao.ValidateAsync(pedido);

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Valor_unitario_zero_e_valido()
    {
        var result = await _criacao.ValidateAsync(Pedido(new CreateMedicaoItemRequest("equipamento", "Cortesia", 1m, 0m)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Mais_de_200_itens_e_invalido()
    {
        var itens = Enumerable.Range(0, 201)
            .Select(i => new CreateMedicaoItemRequest("material", $"Item {i}", 1m, 1m))
            .ToArray();

        var result = await _criacao.ValidateAsync(Pedido(itens));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Etapa_com_guid_vazio_e_invalida()
    {
        var pedido = new CreateMedicaoRequest(
            Guid.NewGuid(), Guid.Empty, 1, new DateOnly(2026, 10, 1),
            [new CreateMedicaoItemRequest("material", "Cimento", 1m, 10m)]);

        var result = await _criacao.ValidateAsync(pedido);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "EtapaId");
    }

    [Theory]
    [InlineData("NF-123")]
    [InlineData("000.123.456")]
    public async Task Numero_de_nf_valido_passa(string numero)
    {
        Assert.True((await _nf.ValidateAsync(new IssueInvoiceRequest(numero))).IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Numero_de_nf_vazio_ou_nulo_e_invalido_sem_lancar_excecao(string? numero)
    {
        Assert.False((await _nf.ValidateAsync(new IssueInvoiceRequest(numero!))).IsValid);
    }

    [Fact]
    public async Task Numero_de_nf_com_mais_de_50_caracteres_e_invalido()
    {
        Assert.False((await _nf.ValidateAsync(new IssueInvoiceRequest(new string('1', 51)))).IsValid);
    }
}
