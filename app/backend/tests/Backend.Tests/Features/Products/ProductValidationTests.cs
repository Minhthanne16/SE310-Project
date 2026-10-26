using Backend.Application.Products;
using Xunit;

namespace Backend.Tests;

public sealed class ProductValidationTests
{
    [Fact]
    public async Task CreateRejectsNegativePrice()
    {
        var validator = new CreateProductValidator();
        var result = await validator.ValidateAsync(new CreateProductCommand(new CreateProductDto
        {
            Name = "Product", Price = -1, Stock = 1
        }));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "Product.Price");
    }

    [Fact]
    public async Task UpdateRejectsNegativeStock()
    {
        var validator = new UpdateProductValidator();
        var result = await validator.ValidateAsync(new UpdateProductCommand(Guid.NewGuid(), new UpdateProductDto
        {
            Name = "Product", Price = 1, Stock = -1
        }));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "Product.Stock");
    }
}
