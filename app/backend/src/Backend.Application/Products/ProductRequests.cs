using AutoMapper;
using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Products;

public record GetProductsQuery : IRequest<ApiResponse<IReadOnlyList<ProductDto>>>;
public record GetProductQuery(Guid Id) : IRequest<ApiResponse<ProductDto>>;
public record CreateProductCommand(CreateProductDto Product) : IRequest<ApiResponse<ProductDto>>;
public record UpdateProductCommand(Guid Id, UpdateProductDto Product) : IRequest<ApiResponse<ProductDto>>;
public record DeleteProductCommand(Guid Id) : IRequest<ApiResponse<bool>>;

public sealed class ProductProfile : Profile
{
    public ProductProfile()
    {
        CreateMap<Product, ProductDto>();
        CreateMap<CreateProductDto, Product>();
        CreateMap<UpdateProductDto, Product>();
    }
}

public sealed class CreateProductValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.Product.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Product.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Product.Stock).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateProductValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductValidator()
    {
        RuleFor(x => x.Product.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Product.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Product.Stock).GreaterThanOrEqualTo(0);
    }
}

public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var context = new ValidationContext<TRequest>(request);
        var failures = new List<FluentValidation.Results.ValidationFailure>();
        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(context, cancellationToken);
            failures.AddRange(result.Errors);
        }
        if (failures.Count > 0) throw new ValidationException(failures);
        return await next(cancellationToken);
    }
}

public sealed class GetProductsHandler(IProductRepository repository, IMapper mapper)
    : IRequestHandler<GetProductsQuery, ApiResponse<IReadOnlyList<ProductDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<ProductDto>>> Handle(GetProductsQuery request, CancellationToken cancellationToken)
    {
        var products = await repository.GetAllAsync();
        return ApiResponse<IReadOnlyList<ProductDto>>.Ok(mapper.Map<List<ProductDto>>(products));
    }
}

public sealed class GetProductHandler(IProductRepository repository, IMapper mapper)
    : IRequestHandler<GetProductQuery, ApiResponse<ProductDto>>
{
    public async Task<ApiResponse<ProductDto>> Handle(GetProductQuery request, CancellationToken cancellationToken)
    {
        var product = await repository.GetByIdAsync(request.Id);
        return product is null ? ApiResponse<ProductDto>.Fail("Product not found") : ApiResponse<ProductDto>.Ok(mapper.Map<ProductDto>(product));
    }
}

public sealed class CreateProductHandler(IProductRepository repository, IMapper mapper)
    : IRequestHandler<CreateProductCommand, ApiResponse<ProductDto>>
{
    public async Task<ApiResponse<ProductDto>> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var product = mapper.Map<Product>(request.Product);
        product.Name = product.Name.Trim();
        product.Description = product.Description?.Trim() ?? string.Empty;
        var created = await repository.AddAsync(product);
        return ApiResponse<ProductDto>.Ok(mapper.Map<ProductDto>(created));
    }
}

public sealed class UpdateProductHandler(IProductRepository repository, IMapper mapper)
    : IRequestHandler<UpdateProductCommand, ApiResponse<ProductDto>>
{
    public async Task<ApiResponse<ProductDto>> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var product = await repository.GetByIdAsync(request.Id);
        if (product is null) return ApiResponse<ProductDto>.Fail("Product not found");
        mapper.Map(request.Product, product);
        product.Name = product.Name.Trim();
        product.Description = product.Description?.Trim() ?? string.Empty;
        product.UpdatedAt = DateTime.UtcNow;
        await repository.UpdateAsync(product);
        return ApiResponse<ProductDto>.Ok(mapper.Map<ProductDto>(product));
    }
}

public sealed class DeleteProductHandler(IProductRepository repository)
    : IRequestHandler<DeleteProductCommand, ApiResponse<bool>>
{
    public async Task<ApiResponse<bool>> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        if (await repository.GetByIdAsync(request.Id) is null) return ApiResponse<bool>.Fail("Product not found");
        await repository.DeleteAsync(request.Id);
        return ApiResponse<bool>.Ok(true);
    }
}
