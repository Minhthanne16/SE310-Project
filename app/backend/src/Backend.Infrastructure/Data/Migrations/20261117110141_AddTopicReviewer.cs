using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicReviewer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewerAssignedAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewerAssignedById",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewerFirstScoredAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewerId",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThesisTopics_ReviewerId",
                table: "ThesisTopics",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisTopics_RoundId_ReviewerId",
                table: "ThesisTopics",
                columns: new[] { "RoundId", "ReviewerId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ThesisTopics_ReviewerNotSupervisor",
                table: "ThesisTopics",
                sql: "\"ReviewerId\" IS NULL OR \"ReviewerId\" <> \"SupervisorId\"");

            migrationBuilder.AddForeignKey(
                name: "FK_ThesisTopics_Users_ReviewerId",
                table: "ThesisTopics",
                column: "ReviewerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThesisTopics_Users_ReviewerId",
                table: "ThesisTopics");

            migrationBuilder.DropIndex(
                name: "IX_ThesisTopics_ReviewerId",
                table: "ThesisTopics");

            migrationBuilder.DropIndex(
                name: "IX_ThesisTopics_RoundId_ReviewerId",
                table: "ThesisTopics");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ThesisTopics_ReviewerNotSupervisor",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ReviewerAssignedAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ReviewerAssignedById",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ReviewerFirstScoredAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ReviewerId",
                table: "ThesisTopics");
        }
    }
}
