using Backend.Application.Auth;
using Backend.Application.Products;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Backend.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(GetProductsQuery).Assembly));
        services.AddValidatorsFromAssemblyContaining<CreateProductValidator>();
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddAutoMapper(cfg => {}, typeof(ProductProfile).Assembly);
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IActivationCodeGenerator, RandomActivationCodeGenerator>();
        return services;
    }
}
