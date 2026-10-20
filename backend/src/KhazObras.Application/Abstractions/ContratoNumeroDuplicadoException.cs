namespace KhazObras.Application.Abstractions;

/// <summary>Violacao da unicidade (obra_id, numero) ao criar contrato (corrida entre dois pedidos).</summary>
public sealed class ContratoNumeroDuplicadoException : Exception
{
    public ContratoNumeroDuplicadoException()
        : base("Ja existe um contrato com este numero nesta obra.")
    {
    }
}
