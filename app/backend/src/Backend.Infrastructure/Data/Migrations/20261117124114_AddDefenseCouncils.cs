using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseCouncils : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DefenseCouncils",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ChairId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecretaryId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefenseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Room = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    NormalizedRoom = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PublishedById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelReason = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    FirstScoredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DefenseCouncils", x => x.Id);
                    table.CheckConstraint("CK_DefenseCouncils_ChairNotSecretary", "\"ChairId\" <> \"SecretaryId\"");
                    table.ForeignKey(
                        name: "FK_DefenseCouncils_ThesisRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DefenseCouncils_Users_ChairId",
                        column: x => x.ChairId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DefenseCouncils_Users_SecretaryId",
                        column: x => x.SecretaryId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DefenseCouncilLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CouncilId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Reason = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: true),
                    Detail = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DefenseCouncilLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DefenseCouncilLogs_DefenseCouncils_CouncilId",
                        column: x => x.CouncilId,
                        principalTable: "DefenseCouncils",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DefenseSlots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CouncilId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DefenseSlots", x => x.Id);
                    table.CheckConstraint("CK_DefenseSlots_EndAfterStart", "\"EndTime\" > \"StartTime\"");
                    table.ForeignKey(
                        name: "FK_DefenseSlots_DefenseCouncils_CouncilId",
                        column: x => x.CouncilId,
                        principalTable: "DefenseCouncils",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DefenseSlots_ThesisTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "ThesisTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DefenseCouncilLogs_CouncilId_CreatedAt",
                table: "DefenseCouncilLogs",
                columns: new[] { "CouncilId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DefenseCouncils_ChairId",
                table: "DefenseCouncils",
                column: "ChairId");

            migrationBuilder.CreateIndex(
                name: "IX_DefenseCouncils_DefenseDate",
                table: "DefenseCouncils",
                column: "DefenseDate");

            migrationBuilder.CreateIndex(
                name: "IX_DefenseCouncils_RoundId",
                table: "DefenseCouncils",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_DefenseCouncils_SecretaryId",
                table: "DefenseCouncils",
                column: "SecretaryId");

            migrationBuilder.CreateIndex(
                name: "IX_DefenseSlots_ActiveTopic",
                table: "DefenseSlots",
                column: "TopicId",
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_DefenseSlots_CouncilId_Order",
                table: "DefenseSlots",
                columns: new[] { "CouncilId", "Order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DefenseCouncilLogs");

            migrationBuilder.DropTable(
                name: "DefenseSlots");

            migrationBuilder.DropTable(
                name: "DefenseCouncils");
        }
    }
}
