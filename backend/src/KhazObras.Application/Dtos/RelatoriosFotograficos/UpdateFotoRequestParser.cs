using System.Globalization;
using System.Text.Json;
using KhazObras.Application.Services;

namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

/// <summary>
/// Le o corpo do PATCH de foto distinguindo "campo ausente" (mantem) de "campo null" (limpa), o que o binding
/// normal para um record nao consegue. Devolve false com os erros por campo (formato do ValidationProblem).
/// </summary>
public static class UpdateFotoRequestParser
{
    public static bool TryParse(JsonElement body, out UpdateFotoRequest request, out Dictionary<string, string[]> erros)
    {
        erros = new Dictionary<string, string[]>();
        request = new UpdateFotoRequest(false, null, false, null, false, 0);

        if (body.ValueKind != JsonValueKind.Object)
        {
            erros["Body"] = ["O corpo deve ser um objeto JSON."];
            return false;
        }

        var descricaoInformada = false;
        string? descricao = null;
        var dataFotoInformada = false;
        DateOnly? dataFoto = null;
        var ordemInformada = false;
        var ordem = 0;

        foreach (var property in body.EnumerateObject())
        {
            if (string.Equals(property.Name, "descricao", StringComparison.OrdinalIgnoreCase))
            {
                descricaoInformada = true;
                if (property.Value.ValueKind == JsonValueKind.String)
                {
                    descricao = property.Value.GetString();
                }
                else if (property.Value.ValueKind != JsonValueKind.Null)
                {
                    erros["Descricao"] = ["A descricao deve ser texto ou null."];
                }
            }
            else if (string.Equals(property.Name, "dataFoto", StringComparison.OrdinalIgnoreCase))
            {
                dataFotoInformada = true;
                if (property.Value.ValueKind == JsonValueKind.String)
                {
                    if (DateOnly.TryParseExact(property.Value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var data))
                    {
                        dataFoto = data;
                    }
                    else
                    {
                        erros["DataFoto"] = ["A data da foto deve estar no formato yyyy-MM-dd."];
                    }
                }
                else if (property.Value.ValueKind != JsonValueKind.Null)
                {
                    erros["DataFoto"] = ["A data da foto deve ser texto yyyy-MM-dd ou null."];
                }
            }
            else if (string.Equals(property.Name, "ordem", StringComparison.OrdinalIgnoreCase))
            {
                ordemInformada = true;
                if (property.Value.ValueKind == JsonValueKind.Number && property.Value.TryGetInt32(out var numero))
                {
                    ordem = numero;
                }
                else
                {
                    erros["Ordem"] = ["A ordem deve ser um numero inteiro."];
                }
            }
        }

        if (!descricaoInformada && !dataFotoInformada && !ordemInformada)
        {
            erros["Body"] = ["Informe ao menos um campo: descricao, dataFoto ou ordem."];
        }

        // Limites (so dos campos enviados e bem formados; a chave do erro nao se repete se o formato ja falhou).
        foreach (var (campo, mensagens) in FotoRegras.Erros(
                     descricaoInformada ? descricao : null,
                     dataFotoInformada ? dataFoto : null,
                     ordemInformada && !erros.ContainsKey("Ordem") ? ordem : null))
        {
            erros.TryAdd(campo, mensagens);
        }

        if (erros.Count > 0)
        {
            return false;
        }

        request = new UpdateFotoRequest(descricaoInformada, FotoRegras.NormalizarDescricao(descricao), dataFotoInformada, dataFoto, ordemInformada, ordem);
        return true;
    }
}
