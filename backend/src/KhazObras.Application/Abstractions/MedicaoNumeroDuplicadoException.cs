namespace KhazObras.Application.Abstractions;

/// <summary>Violacao da unicidade (obra_id, numero) ao criar medicao (corrida entre dois pedidos).</summary>
public sealed class MedicaoNumeroDuplicadoException : Exception
{
    public MedicaoNumeroDuplicadoException()
        : base("Ja existe uma medicao com este numero nesta obra.")
    {
    }
}
