using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddThesisRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ThesisRounds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Program = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PeriodLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CopiedFromId = table.Column<Guid>(type: "uuid", nullable: true),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThesisRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThesisRounds_ThesisRounds_CopiedFromId",
                        column: x => x.CopiedFromId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "RoundMilestones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NotifyAudience = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AllowLate = table.Column<bool>(type: "boolean", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoundMilestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoundMilestones_ThesisRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoundParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoundParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoundParticipants_ThesisRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RoundParticipants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoundMilestones_RoundId_Key",
                table: "RoundMilestones",
                columns: new[] { "RoundId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoundParticipants_RoundId_UserId",
                table: "RoundParticipants",
                columns: new[] { "RoundId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoundParticipants_UserId",
                table: "RoundParticipants",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisRounds_CopiedFromId",
                table: "ThesisRounds",
                column: "CopiedFromId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisRounds_NormalizedName",
                table: "ThesisRounds",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ThesisRounds_Status",
                table: "ThesisRounds",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoundMilestones");

            migrationBuilder.DropTable(
                name: "RoundParticipants");

            migrationBuilder.DropTable(
                name: "ThesisRounds");
        }
    }
}
