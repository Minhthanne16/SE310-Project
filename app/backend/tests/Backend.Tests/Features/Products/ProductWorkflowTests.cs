using Backend.Application;
using Backend.Application.Products;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class ProductWorkflowTests
{
    [Fact]
    public async Task CreateAndReadProductThroughMediator()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddSingleton<IProductRepository, FakeRepository>();
        using var provider = services.BuildServiceProvider();
        var sender = provider.GetRequiredService<ISender>();

        var created = await sender.Send(new CreateProductCommand(new CreateProductDto
        {
            Name = "  Keyboard  ", Description = "  Mechanical  ", Price = 100, Stock = 2
        }));
        var loaded = await sender.Send(new GetProductQuery(created.Data!.Id));

        Assert.True(loaded.Success);
        Assert.Equal("Keyboard", loaded.Data!.Name);
        Assert.Equal("Mechanical", loaded.Data.Description);
        Assert.Equal(100, loaded.Data.Price);
    }

    private sealed class FakeRepository : IProductRepository
    {
        private readonly Dictionary<Guid, Product> _products = [];

        public Task<IReadOnlyList<Product>> GetAllAsync() => Task.FromResult<IReadOnlyList<Product>>(_products.Values.ToList());
        public Task<Product?> GetByIdAsync(Guid id) => Task.FromResult(_products.GetValueOrDefault(id));
        public Task<Product> AddAsync(Product product)
        {
            _products.Add(product.Id, product);
            return Task.FromResult(product);
        }
        public Task UpdateAsync(Product product)
        {
            _products[product.Id] = product;
            return Task.CompletedTask;
        }
        public Task DeleteAsync(Guid id)
        {
            _products.Remove(id);
            return Task.CompletedTask;
        }
    }
}
