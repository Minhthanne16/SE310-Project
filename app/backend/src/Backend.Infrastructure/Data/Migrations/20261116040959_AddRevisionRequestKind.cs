using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRevisionRequestKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "RevisionRequests",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Outline");

            migrationBuilder.CreateIndex(
                name: "IX_RevisionRequests_TopicId_Kind_ResolvedAt",
                table: "RevisionRequests",
                columns: new[] { "TopicId", "Kind", "ResolvedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RevisionRequests_TopicId_Kind_ResolvedAt",
                table: "RevisionRequests");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "RevisionRequests");
        }
    }
}
