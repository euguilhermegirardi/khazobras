using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IDashboardClienteRepository
{
    /// <summary>
    /// Dados do dashboard da obra numa unica ida ao banco (consultas agregadas, todas com WHERE obra_id).
    /// Null se a obra nao existir. O endpoint ja validou o acesso a ela.
    /// </summary>
    Task<DashboardClienteDados?> GetDadosAsync(Guid obraId, CancellationToken cancellationToken = default);
}
