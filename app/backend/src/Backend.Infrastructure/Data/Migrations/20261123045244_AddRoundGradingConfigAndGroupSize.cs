using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRoundGradingConfigAndGroupSize : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GradingConfig_DeviationThreshold",
                table: "ThesisRounds",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 2m);

            migrationBuilder.AddColumn<decimal>(
                name: "GradingConfig_WeightChair",
                table: "ThesisRounds",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<decimal>(
                name: "GradingConfig_WeightReviewer",
                table: "ThesisRounds",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 2m);

            migrationBuilder.AddColumn<decimal>(
                name: "GradingConfig_WeightSecretary",
                table: "ThesisRounds",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 1m);

            migrationBuilder.AddColumn<decimal>(
                name: "GradingConfig_WeightSupervisor",
                table: "ThesisRounds",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 2m);

            migrationBuilder.AddColumn<int>(
                name: "MaxGroupSize",
                table: "ThesisRounds",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.CreateTable(
                name: "ProgramRoundDefaults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Program = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MaxGroupSize = table.Column<int>(type: "integer", nullable: false, defaultValue: 2),
                    WeightChair = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 1m),
                    WeightSecretary = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 1m),
                    WeightSupervisor = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 2m),
                    WeightReviewer = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 2m),
                    DeviationThreshold = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 2m),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramRoundDefaults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramRoundDefaults_Users_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramRoundDefaults_Program",
                table: "ProgramRoundDefaults",
                column: "Program",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgramRoundDefaults_UpdatedById",
                table: "ProgramRoundDefaults",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProgramRoundDefaults");

            migrationBuilder.DropColumn(
                name: "GradingConfig_DeviationThreshold",
                table: "ThesisRounds");

            migrationBuilder.DropColumn(
                name: "GradingConfig_WeightChair",
                table: "ThesisRounds");

            migrationBuilder.DropColumn(
                name: "GradingConfig_WeightReviewer",
                table: "ThesisRounds");

            migrationBuilder.DropColumn(
                name: "GradingConfig_WeightSecretary",
                table: "ThesisRounds");

            migrationBuilder.DropColumn(
                name: "GradingConfig_WeightSupervisor",
                table: "ThesisRounds");

            migrationBuilder.DropColumn(
                name: "MaxGroupSize",
                table: "ThesisRounds");
        }
    }
}
