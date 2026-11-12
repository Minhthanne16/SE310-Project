using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionsAndLateDeadline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "LateEndDate",
                table: "RoundMilestones",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: false),
                    IsLate = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Submissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Submissions_ThesisTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "ThesisTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Submissions_Users_SubmittedById",
                        column: x => x.SubmittedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_ObjectKey",
                table: "Submissions",
                column: "ObjectKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_SubmittedById",
                table: "Submissions",
                column: "SubmittedById");

            migrationBuilder.CreateIndex(
                name: "IX_Submissions_TopicId_Kind_Version",
                table: "Submissions",
                columns: new[] { "TopicId", "Kind", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Submissions");

            migrationBuilder.DropColumn(
                name: "LateEndDate",
                table: "RoundMilestones");
        }
    }
}
