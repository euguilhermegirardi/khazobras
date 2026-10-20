namespace KhazObras.Application.Dtos.Financeiro;

public sealed record UpdateVisibilidadeLoteRequest(List<Guid> Ids, bool VisivelCliente);
