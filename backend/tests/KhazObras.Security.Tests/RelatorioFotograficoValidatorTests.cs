using System.Text.Json;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Services;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>Regras de entrada do relatorio fotografico: validators, limites das fotos e leitura do PATCH parcial.</summary>
public sealed class RelatorioFotograficoValidatorTests
{
    // ===== Create / Update =====

    [Fact]
    public async Task Create_valido_passa_e_competencia_fora_de_2000_2100_falha()
    {
        var ok = new CreateRelatorioFotograficoRequest(Guid.NewGuid(), "mensal", null, "Outubro", new DateOnly(2026, 10, 1));
        var antigo = ok with { Competencia = new DateOnly(1999, 12, 1) };
        var futuro = ok with { Competencia = new DateOnly(2101, 1, 1) };
        var validator = new CreateRelatorioFotograficoRequestValidator();

        Assert.True((await validator.ValidateAsync(ok)).IsValid);
        Assert.Contains((await validator.ValidateAsync(antigo)).Errors, e => e.PropertyName == "Competencia");
        Assert.Contains((await validator.ValidateAsync(futuro)).Errors, e => e.PropertyName == "Competencia");
    }

    [Fact]
    public async Task Update_sem_titulo_ou_tipo_e_invalido_sem_lancar_excecao()
    {
        var request = new UpdateRelatorioFotograficoRequest(null!, null, null!, null);

        var result = await new UpdateRelatorioFotograficoRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Tipo");
        Assert.Contains(result.Errors, e => e.PropertyName == "Titulo");
    }

    [Theory]
    [InlineData("mensal", "Setembro", true)]
    [InlineData("ETAPA", "Fundacao", true)]
    [InlineData("anual", "Setembro", false)]
    [InlineData("mensal", "", false)]
    [InlineData("mensal", "   ", false)]
    public async Task Update_valida_tipo_e_titulo(string tipo, string titulo, bool valido)
    {
        var result = await new UpdateRelatorioFotograficoRequestValidator()
            .ValidateAsync(new UpdateRelatorioFotograficoRequest(tipo, null, titulo, null));

        Assert.Equal(valido, result.IsValid);
    }

    [Fact]
    public async Task Update_recusa_titulo_com_mais_de_150_caracteres()
    {
        var validator = new UpdateRelatorioFotograficoRequestValidator();

        var noLimite = await validator.ValidateAsync(new UpdateRelatorioFotograficoRequest("mensal", null, new string('x', 150), null));
        var estourou = await validator.ValidateAsync(new UpdateRelatorioFotograficoRequest("mensal", null, new string('x', 151), null));

        Assert.True(noLimite.IsValid);
        Assert.False(estourou.IsValid);
    }

    // ===== Reordenar =====

    [Fact]
    public async Task Reordenar_sem_lista_e_invalido_sem_lancar_excecao()
    {
        var result = await new ReordenarFotosRequestValidator().ValidateAsync(new ReordenarFotosRequest(null!));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Reordenar_com_item_nulo_e_invalido_sem_lancar_excecao()
    {
        var result = await new ReordenarFotosRequestValidator().ValidateAsync(new ReordenarFotosRequest([null!]));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Reordenar_valida_limites_repeticao_e_ordem()
    {
        var validator = new ReordenarFotosRequestValidator();
        var id = Guid.NewGuid();

        var ok = await validator.ValidateAsync(new ReordenarFotosRequest([new FotoOrdemItem(id, 0), new FotoOrdemItem(Guid.NewGuid(), 100_000)]));
        var repetido = await validator.ValidateAsync(new ReordenarFotosRequest([new FotoOrdemItem(id, 0), new FotoOrdemItem(id, 1)]));
        var negativa = await validator.ValidateAsync(new ReordenarFotosRequest([new FotoOrdemItem(id, -1)]));
        var vazio = await validator.ValidateAsync(new ReordenarFotosRequest([new FotoOrdemItem(Guid.Empty, 0)]));
        var duzentos = await validator.ValidateAsync(new ReordenarFotosRequest(
            Enumerable.Range(0, 200).Select(i => new FotoOrdemItem(Guid.NewGuid(), i)).ToList()));
        var duzentosEUm = await validator.ValidateAsync(new ReordenarFotosRequest(
            Enumerable.Range(0, 201).Select(i => new FotoOrdemItem(Guid.NewGuid(), i)).ToList()));

        Assert.True(ok.IsValid);
        Assert.False(repetido.IsValid);
        Assert.False(negativa.IsValid);
        Assert.False(vazio.IsValid);
        Assert.True(duzentos.IsValid);
        Assert.False(duzentosEUm.IsValid);
    }

    // ===== FotoRegras =====

    [Fact]
    public void Regras_aceitam_valores_nos_limites_e_recusam_fora_deles()
    {
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);

        Assert.Empty(FotoRegras.Erros(new string('d', 255), new DateOnly(2000, 1, 1), 0));
        Assert.Empty(FotoRegras.Erros(null, hoje.AddDays(1), FotoRegras.OrdemMaxima));
        Assert.Empty(FotoRegras.Erros(null, null, null));
        Assert.Contains("Descricao", FotoRegras.Erros(new string('d', 256), null, null).Keys);
        Assert.Contains("DataFoto", FotoRegras.Erros(null, new DateOnly(1999, 12, 31), null).Keys);
        Assert.Contains("DataFoto", FotoRegras.Erros(null, hoje.AddDays(2), null).Keys);
        Assert.Contains("Ordem", FotoRegras.Erros(null, null, -1).Keys);
        Assert.Contains("Ordem", FotoRegras.Erros(null, null, FotoRegras.OrdemMaxima + 1).Keys);
    }

    [Fact]
    public void Descricao_e_medida_depois_de_aparar_os_espacos()
    {
        var comEspacos = "  " + new string('d', 255) + "  ";

        Assert.Empty(FotoRegras.Erros(comEspacos, null, null));
        Assert.Null(FotoRegras.NormalizarDescricao("   "));
        Assert.Equal("Viga", FotoRegras.NormalizarDescricao(" Viga "));
    }

    [Theory]
    [InlineData(".jpg", "image/jpeg", true)]
    [InlineData(".JPEG", "image/jpeg", false)] // a extensao precisa chegar normalizada (minusculas)
    [InlineData(".png", "IMAGE/PNG", true)]
    [InlineData(".webp", "image/webp", true)]
    [InlineData(".gif", "image/gif", true)]
    [InlineData(".pdf", "application/pdf", false)]
    [InlineData(".png", "application/pdf", false)]
    public void Imagem_exige_extensao_e_content_type_de_imagem(string extensao, string contentType, bool esperado)
    {
        Assert.Equal(esperado, FotoRegras.IsImagem(extensao, contentType));
    }

    // ===== Parser do PATCH de foto =====

    private static bool Parse(string json, out UpdateFotoRequest request, out Dictionary<string, string[]> erros)
    {
        using var documento = JsonDocument.Parse(json);
        return UpdateFotoRequestParser.TryParse(documento.RootElement, out request, out erros);
    }

    [Fact]
    public void Parser_distingue_campo_ausente_de_campo_null()
    {
        Assert.True(Parse("""{"descricao": null}""", out var limpar, out _));
        Assert.True(limpar.DescricaoInformada);
        Assert.Null(limpar.Descricao);
        Assert.False(limpar.DataFotoInformada);
        Assert.False(limpar.OrdemInformada);

        Assert.True(Parse("""{"ordem": 3, "dataFoto": "2026-10-01"}""", out var parcial, out _));
        Assert.False(parcial.DescricaoInformada);
        Assert.True(parcial.OrdemInformada);
        Assert.Equal(3, parcial.Ordem);
        Assert.Equal(new DateOnly(2026, 10, 1), parcial.DataFoto);
    }

    [Fact]
    public void Parser_aceita_nomes_de_campo_em_qualquer_caixa_e_apara_a_descricao()
    {
        Assert.True(Parse("""{"Descricao": "  Viga  ", "DATAFOTO": null}""", out var request, out _));

        Assert.Equal("Viga", request.Descricao);
        Assert.True(request.DataFotoInformada);
        Assert.Null(request.DataFoto);
    }

    [Theory]
    [InlineData("""[]""", "Body")]
    [InlineData("""{}""", "Body")]
    [InlineData("""{"foo": 1}""", "Body")]
    [InlineData("""{"descricao": 5}""", "Descricao")]
    [InlineData("""{"dataFoto": "01/10/2026"}""", "DataFoto")]
    [InlineData("""{"dataFoto": 20261001}""", "DataFoto")]
    [InlineData("""{"dataFoto": "1999-12-31"}""", "DataFoto")]
    [InlineData("""{"ordem": "2"}""", "Ordem")]
    [InlineData("""{"ordem": null}""", "Ordem")]
    [InlineData("""{"ordem": 1.5}""", "Ordem")]
    [InlineData("""{"ordem": -1}""", "Ordem")]
    public void Parser_recusa_corpo_invalido_com_o_erro_no_campo_certo(string json, string campo)
    {
        Assert.False(Parse(json, out _, out var erros));
        Assert.Contains(campo, erros.Keys);
    }
}
