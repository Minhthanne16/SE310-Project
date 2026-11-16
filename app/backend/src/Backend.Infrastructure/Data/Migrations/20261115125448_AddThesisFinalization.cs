using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddThesisFinalization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"RoundMilestones\" SET \"AllowLate\" = FALSE WHERE \"Key\" = 'Finalize' AND \"AllowLate\" IS NULL");
            migrationBuilder.AddColumn<DateTime>(
                name: "FinalThesisLockedAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinalThesisLockedById",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinalThesisSubmissionId",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "IneligibleAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "IneligibleById",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IneligibleReason",
                table: "ThesisTopics",
                type: "character varying(800)",
                maxLength: 800,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ThesisExtensionEnd",
                table: "ThesisTopics",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ThesisExtensionGrantedAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ThesisExtensionGrantedById",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ThesisExtensionReason",
                table: "ThesisTopics",
                type: "character varying(800)",
                maxLength: 800,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinalThesisLockedAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "FinalThesisLockedById",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "FinalThesisSubmissionId",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "IneligibleAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "IneligibleById",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "IneligibleReason",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ThesisExtensionEnd",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ThesisExtensionGrantedAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ThesisExtensionGrantedById",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "ThesisExtensionReason",
                table: "ThesisTopics");
        }
    }
}
