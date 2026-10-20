namespace KhazObras.Domain.Entities;

/// <summary>Soma das medicoes aprovadas (approved/invoice_issued) de UM mes de competencia (sempre o dia 1).</summary>
public sealed class MedidoMes
{
    public DateOnly Competencia { get; set; }
    public decimal Valor { get; set; }
}

/// <summary>
/// Dados brutos do dashboard do cliente, lidos numa unica ida ao banco e presos a obra. Contem so o que a visao
/// do cliente precisa: valor contratado e medicoes aprovadas. NUNCA lancamentos do financeiro, custo real nem margem.
/// A <see cref="Etapa"/> carrega o peso so para o calculo do avanco no servidor; o peso nao sai na resposta.
/// </summary>
public sealed class DashboardClienteDados
{
    public Obra Obra { get; set; } = new();
    public IReadOnlyList<Etapa> Etapas { get; set; } = [];
    public IReadOnlyList<MedidoMes> MedidoPorMes { get; set; } = [];
    public decimal TotalPago { get; set; }
}
