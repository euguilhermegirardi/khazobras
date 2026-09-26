using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Fornecedores;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class FornecedorService
{
    private readonly IFornecedorRepository _repository;

    public FornecedorService(IFornecedorRepository repository) => _repository = repository;

    public async Task<FornecedorResponse> CreateAsync(CreateFornecedorRequest request)
    {
        var fornecedor = new Fornecedor
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome,
            CnpjCpf = request.CnpjCpf,
            Contato = request.Contato,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(fornecedor);
        return ToResponse(created);
    }

    public async Task<FornecedorResponse?> GetByIdAsync(Guid id)
    {
        var fornecedor = await _repository.GetByIdAsync(id);
        return fornecedor is null ? null : ToResponse(fornecedor);
    }

    public async Task<IReadOnlyList<FornecedorResponse>> GetAllAsync()
    {
        var fornecedores = await _repository.GetAllAsync();
        return fornecedores.Select(ToResponse).ToList();
    }

    private static FornecedorResponse ToResponse(Fornecedor f) => new(f.Id, f.Nome, f.CnpjCpf, f.Contato, f.CreatedAt);
}