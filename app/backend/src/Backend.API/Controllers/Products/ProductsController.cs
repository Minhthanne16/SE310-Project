using Backend.Application.Common;
using Backend.Application.Products;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Products;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ProductDto>>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetProductsQuery(), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetProductQuery(id), cancellationToken);
        return result.Success ? Ok(result) : NotFound(result);
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Create(CreateProductDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateProductCommand(dto), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Update(Guid id, UpdateProductDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new UpdateProductCommand(id, dto), cancellationToken);
        return result.Success ? Ok(result) : NotFound(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new DeleteProductCommand(id), cancellationToken);
        return result.Success ? Ok(result) : NotFound(result);
    }
}
