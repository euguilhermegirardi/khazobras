using KhazObras.Application.Dtos.Notificacoes;
using KhazObras.Application.Dtos.Auditoria;
using KhazObras.Application.Dtos.Fornecedores;
using KhazObras.Application.Dtos.Prestadores;
using KhazObras.Application.Dtos.Estoque;
using KhazObras.Application.Dtos.Pipelines;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Dtos.Etapas;
using KhazObras.Infrastructure.Storage;
using FluentValidation;
using KhazObras.Application.Dtos.Obras;
using KhazObras.Infrastructure.Repositories;
using KhazObras.Application.Validators;
using System.Security.Claims;
using System.Text;
using Dapper;
using KhazObras.Api.Middlewares;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auth;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Services;
using KhazObras.Infrastructure.Persistence;
using KhazObras.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Persistencia
builder.Services.AddSingleton<IDbConnectionFactory, NpgsqlConnectionFactory>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// Seguranca
builder.Services.AddScoped<IPasswordHasher, PasswordHasherAdapter>();
builder.Services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
builder.Services.AddSingleton<IStorageService, R2StorageService>();

// Application services
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<IObraRepository, ObraRepository>();
builder.Services.AddScoped<ObraService>();
builder.Services.AddScoped<IEtapaRepository, EtapaRepository>();
builder.Services.AddScoped<EtapaService>();
builder.Services.AddScoped<IMedicaoRepository, MedicaoRepository>();
builder.Services.AddScoped<MedicaoService>();
builder.Services.AddScoped<IFinanceiroLancamentoRepository, FinanceiroLancamentoRepository>();
builder.Services.AddScoped<FinanceiroService>();
builder.Services.AddScoped<IRelatorioFotograficoRepository, RelatorioFotograficoRepository>();
builder.Services.AddScoped<RelatorioFotograficoService>();
builder.Services.AddScoped<IRelatorioMensalRepository, RelatorioMensalRepository>();
builder.Services.AddScoped<RelatorioMensalService>();
builder.Services.AddScoped<IProjetoDocumentoRepository, ProjetoDocumentoRepository>();
builder.Services.AddScoped<ProjetoDocumentoService>();
builder.Services.AddScoped<IFornecedorRepository, FornecedorRepository>();
builder.Services.AddScoped<FornecedorService>();
builder.Services.AddScoped<IPrestadorRepository, PrestadorRepository>();
builder.Services.AddScoped<PrestadorService>();
builder.Services.AddScoped<IEstoqueRepository, EstoqueRepository>();
builder.Services.AddScoped<EstoqueService>();
builder.Services.AddScoped<IPipelineRepository, PipelineRepository>();
builder.Services.AddScoped<PipelineService>();
builder.Services.AddScoped<INotificacaoRepository, NotificacaoRepository>();
builder.Services.AddScoped<NotificacaoService>();
builder.Services.AddScoped<ILogAuditoriaRepository, LogAuditoriaRepository>();
builder.Services.AddScoped<LogAuditoriaService>();
builder.Services.AddScoped<IUserObraRepository, UserObraRepository>();
builder.Services.AddScoped<ObraAccessService>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateObraRequestValidator>();

// Erro global
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Autenticacao JWT
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("MasterOnly", policy => policy.RequireRole("Master"));
    options.AddPolicy("AdminOrMaster", policy => policy.RequireRole("Admin", "Master"));
});

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthcheck", async (IDbConnectionFactory dbFactory, ILogger<Program> logger) =>
{
    try
    {
        using var connection = dbFactory.CreateConnection();
        await connection.ExecuteScalarAsync<int>("SELECT 1");
        return Results.Ok(new { status = "healthy", database = "connected" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Healthcheck falhou - banco de dados indisponivel");
        return Results.Problem(
            detail: "Banco de dados indisponivel.",
            statusCode: 500,
            title: "Servico indisponivel");
    }
})
.WithName("HealthCheck");

app.MapPost("/auth/login", async (LoginRequest request, AuthService authService) =>
{
    var result = await authService.LoginAsync(request);
    return result is null ? Results.Unauthorized() : Results.Ok(result);
})
.WithName("Login");

app.MapPost("/users", async (CreateUserRequest request, IValidator<CreateUserRequest> validator, UserService userService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var createdByUserId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await userService.CreateAsync(request, createdByUserId);
    return Results.Created($"/users/{result.Id}", result);
})
.RequireAuthorization("MasterOnly")
.WithName("CreateUser");

app.MapGet("/users/me", async (ClaimsPrincipal principal, IUserRepository userRepository) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await userRepository.GetByIdAsync(userId);

    return user is null
        ? Results.NotFound()
        : Results.Ok(new UserResponse(user.Id, user.Name, user.Email, user.Role.ToString(), user.IsActive, user.CreatedAt));
})
.RequireAuthorization()
.WithName("GetMe");

app.MapPost("/obras", async (CreateObraRequest request, IValidator<CreateObraRequest> validator, ObraService obraService) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var result = await obraService.CreateAsync(request);
    return Results.Created($"/obras/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateObra");

app.MapGet("/obras/{id:guid}", async (Guid id, ObraService obraService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, id);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await obraService.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObraById");

app.MapGet("/obras", async (ObraService obraService, ObraAccessService accessService, IUserObraRepository userObraRepository, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20) =>
{
    if (!accessService.IsAdminOrMaster(principal))
    {
        var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var obraIds = await userObraRepository.GetObraIdsForUserAsync(userId);
        var obras = new List<KhazObras.Application.Dtos.Obras.ObraResponse>();

        foreach (var id in obraIds)
        {
            var obra = await obraService.GetByIdAsync(id);
            if (obra is not null)
            {
                obras.Add(obra);
            }
        }

        return Results.Ok(new { totalItems = obras.Count, pageIndex = 0, pageSize = obras.Count, items = obras });
    }

    var result = await obraService.GetPagedAsync(pageIndex, pageSize);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObras");

app.MapPost("/etapas", async (CreateEtapaRequest request, IValidator<CreateEtapaRequest> validator, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.CreateAsync(request);
    return Results.Created($"/etapas/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateEtapa");

app.MapGet("/etapas/{id:guid}", async (Guid id, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await etapaService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapaById");

app.MapGet("/obras/{obraId:guid}/etapas", async (Guid obraId, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapasByObra");

app.MapPost("/medicoes", async (CreateMedicaoRequest request, IValidator<CreateMedicaoRequest> validator, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.CreateAsync(request);
    return Results.Created($"/medicoes/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateMedicao");

app.MapGet("/medicoes/{id:guid}", async (Guid id, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await medicaoService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMedicaoById");

app.MapGet("/obras/{obraId:guid}/medicoes", async (Guid obraId, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMedicoesByObra");

app.MapPost("/medicoes/{id:guid}/approve", async (Guid id, ClaimsPrincipal principal, MedicaoService medicaoService, ObraAccessService accessService) =>
{
    var existing = await medicaoService.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, existing.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        var result = await medicaoService.ApproveAsync(id, userId);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("ApproveMedicao");

app.MapPost("/medicoes/{id:guid}/issue-invoice", async (Guid id, IssueInvoiceRequest request, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var existing = await medicaoService.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    try
    {
        var result = await medicaoService.IssueInvoiceAsync(id, request.NfNumber);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("IssueMedicaoInvoice");

app.MapPost("/financeiro/lancamentos", async (CreateFinanceiroLancamentoRequest request, IValidator<CreateFinanceiroLancamentoRequest> validator, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.CreateAsync(request, userId);
    return Results.Created($"/financeiro/lancamentos/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateFinanceiroLancamento");

app.MapGet("/financeiro/lancamentos/{id:guid}", async (Guid id, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await financeiroService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentoById");

app.MapGet("/obras/{obraId:guid}/financeiro/lancamentos", async (Guid obraId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await financeiroService.GetPagedByObraIdAsync(obraId, pageIndex, pageSize);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentosByObra");

app.MapPost("/financeiro/lancamentos/{id:guid}/anexos", async (Guid id, IFormFile file, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var lancamento = await financeiroService.GetByIdAsync(id);
    if (lancamento is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, lancamento.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await financeiroService.UploadAnexoAsync(id, stream, file.FileName, file.ContentType, file.Length);
    return Results.Created($"/financeiro/anexos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization()
.WithName("UploadFinanceiroAnexo");

app.MapGet("/financeiro/anexos/{anexoId:guid}/download", async (Guid anexoId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await financeiroService.DownloadAnexoAsync(anexoId);
    if (result is null)
    {
        return Results.NotFound();
    }

    // O anexo nao carrega o ObraId diretamente; usamos MasterOnly como salvaguarda
    // simples ate existir um metodo dedicado de resolucao de obra por anexo.
    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    var (content, fileName, contentType) = result.Value;
    return Results.File(content, contentType ?? "application/octet-stream", fileName);
})
.RequireAuthorization()
.WithName("DownloadFinanceiroAnexo");

app.MapGet("/relatorios-fotograficos/{id:guid}", async (Guid id, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioFotograficoById");

app.MapPost("/relatorios-fotograficos", async (CreateRelatorioFotograficoRequest request, IValidator<CreateRelatorioFotograficoRequest> validator, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.CreateAsync(request);
    return Results.Created($"/relatorios-fotograficos/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateRelatorioFotografico");

app.MapGet("/obras/{obraId:guid}/relatorios-fotograficos", async (Guid obraId, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosFotograficosByObra");

app.MapPost("/relatorios-fotograficos/{id:guid}/fotos", async (Guid id, IFormFile file, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, DateOnly? dataFoto, string? descricao, int ordem = 0) =>
{
    var relatorio = await service.GetByIdAsync(id);
    if (relatorio is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadFotoAsync(id, stream, file.FileName, file.ContentType, dataFoto, descricao, ordem);
    return Results.Created($"/fotos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization()
.WithName("UploadFoto");

app.MapPost("/relatorios-mensais", async (CreateRelatorioMensalRequest request, IValidator<CreateRelatorioMensalRequest> validator, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.CreateAsync(request, userId);
    return Results.Created($"/relatorios-mensais/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateRelatorioMensal");

app.MapGet("/relatorios-mensais/{id:guid}", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioMensalById");

app.MapGet("/obras/{obraId:guid}/relatorios-mensais", async (Guid obraId, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal, bool onlyPublished = false) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId, onlyPublished);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosMensaisByObra");

app.MapPost("/relatorios-mensais/{id:guid}/publish", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var existing = await service.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    try
    {
        var result = await service.PublishAsync(id);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("PublishRelatorioMensal");

app.MapPost("/obras/{obraId:guid}/projetos", async (Guid obraId, IFormFile file, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal, Guid? etapaId, string? tipoDocumento) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadAsync(obraId, etapaId, stream, file.FileName, file.ContentType, tipoDocumento);
    return Results.Created($"/projetos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization()
.WithName("UploadProjetoDocumento");

app.MapGet("/projetos/{id:guid}/download", async (Guid id, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.DownloadAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    // Mesma limitacao do anexo financeiro: DownloadAsync ainda nao expoe ObraId.
    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    var (content, fileName, contentType) = result.Value;
    return Results.File(content, contentType ?? "application/octet-stream", fileName);
})
.RequireAuthorization()
.WithName("DownloadProjetoDocumento");

app.MapGet("/obras/{obraId:guid}/projetos", async (Guid obraId, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetProjetosByObra");

app.MapPost("/fornecedores", async (CreateFornecedorRequest request, FornecedorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/fornecedores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateFornecedor");

app.MapGet("/fornecedores/{id:guid}", async (Guid id, FornecedorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedorById");

app.MapGet("/fornecedores", async (FornecedorService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedores");

app.MapPost("/prestadores", async (CreatePrestadorRequest request, PrestadorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/prestadores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePrestador");

app.MapGet("/prestadores/{id:guid}", async (Guid id, PrestadorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadorById");

app.MapGet("/obras/{obraId:guid}/prestadores", async (Guid obraId, PrestadorService service) =>
{
    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadoresByObra");

app.MapPost("/estoque/itens", async (CreateEstoqueItemRequest request, EstoqueService service) =>
{
    var result = await service.CreateItemAsync(request);
    return Results.Created($"/estoque/itens/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateEstoqueItem");

app.MapGet("/obras/{obraId:guid}/estoque/itens", async (Guid obraId, EstoqueService service) =>
{
    var result = await service.GetItensByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetEstoqueItensByObra");

app.MapPost("/estoque/itens/{itemId:guid}/movimentacoes", async (Guid itemId, CreateMovimentacaoRequest request, EstoqueService service) =>
{
    try
    {
        var result = await service.AddMovimentacaoAsync(itemId, request);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
})
.RequireAuthorization("AdminOrMaster")
.WithName("AddEstoqueMovimentacao");

app.MapPost("/pipeline", async (CreatePipelineRequest request, PipelineService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/pipeline/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePipeline");

app.MapGet("/pipeline", async (PipelineService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPipeline");

app.MapPost("/notificacoes", async (CreateNotificacaoRequest request, NotificacaoService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/notificacoes/{result.Id}", result);
})
.RequireAuthorization()
.WithName("CreateNotificacao");

app.MapGet("/notificacoes/minhas", async (ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var result = await service.GetByUserIdAsync(userId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMinhasNotificacoes");

app.MapPost("/notificacoes/{id:guid}/marcar-lida", async (Guid id, ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        await service.MarkAsReadAsync(id, userId);
        return Results.NoContent();
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }
})
.RequireAuthorization()
.WithName("MarkNotificacaoAsRead");

app.MapGet("/auditoria/{entidade}/{entidadeId:guid}", async (string entidade, Guid entidadeId, LogAuditoriaService service) =>
{
    var result = await service.GetByEntidadeAsync(entidade, entidadeId);
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetAuditoriaByEntidade");

app.MapPost("/users/{userId:guid}/obras/{obraId:guid}", async (Guid userId, Guid obraId, IUserObraRepository userObraRepository) =>
{
    await userObraRepository.LinkAsync(userId, obraId);
    return Results.NoContent();
})
.RequireAuthorization("MasterOnly")
.WithName("LinkUserToObra");

app.MapGet("/users", async (IUserRepository userRepository) =>
{
    var users = await userRepository.GetAllAsync();
    var result = users.Select(u => new UserResponse(u.Id, u.Name, u.Email, u.Role.ToString(), u.IsActive, u.CreatedAt)).ToList();
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetUsers");

app.Run();