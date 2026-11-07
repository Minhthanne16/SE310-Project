using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "GroupId",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ThesisGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    RepresentativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ThesisGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ThesisGroups_ThesisRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ThesisGroups_Users_RepresentativeId",
                        column: x => x.RepresentativeId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GroupMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    StudentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupMembers_ThesisGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "ThesisGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupMembers_ThesisRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "ThesisRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GroupMembers_Users_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TopicRegistrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    RegisteredById = table.Column<Guid>(type: "uuid", nullable: false),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicRegistrations_ThesisGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "ThesisGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TopicRegistrations_ThesisTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "ThesisTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ThesisTopics_GroupId",
                table: "ThesisTopics",
                column: "GroupId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupMembers_GroupId",
                table: "GroupMembers",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupMembers_RoundId_StudentId",
                table: "GroupMembers",
                columns: new[] { "RoundId", "StudentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupMembers_StudentId",
                table: "GroupMembers",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisGroups_RepresentativeId",
                table: "ThesisGroups",
                column: "RepresentativeId");

            migrationBuilder.CreateIndex(
                name: "IX_ThesisGroups_RoundId",
                table: "ThesisGroups",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_TopicRegistrations_GroupId_CreatedAt",
                table: "TopicRegistrations",
                columns: new[] { "GroupId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicRegistrations_TopicId",
                table: "TopicRegistrations",
                column: "TopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_ThesisTopics_ThesisGroups_GroupId",
                table: "ThesisTopics",
                column: "GroupId",
                principalTable: "ThesisGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ThesisTopics_ThesisGroups_GroupId",
                table: "ThesisTopics");

            migrationBuilder.DropTable(
                name: "GroupMembers");

            migrationBuilder.DropTable(
                name: "TopicRegistrations");

            migrationBuilder.DropTable(
                name: "ThesisGroups");

            migrationBuilder.DropIndex(
                name: "IX_ThesisTopics_GroupId",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "ThesisTopics");
        }
    }
}
