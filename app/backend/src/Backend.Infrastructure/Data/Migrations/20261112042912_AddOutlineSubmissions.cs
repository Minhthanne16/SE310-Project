using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOutlineSubmissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OutlineApprovedAt",
                table: "ThesisTopics",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OutlineApprovedById",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OutlineApprovedSubmissionId",
                table: "ThesisTopics",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TopicSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    VersionNo = table.Column<int>(type: "integer", nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Late = table.Column<bool>(type: "boolean", nullable: false),
                    ReviewComment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReviewedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TopicSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TopicSubmissions_ThesisTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "ThesisTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TopicSubmissions_Users_SubmittedById",
                        column: x => x.SubmittedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RevisionRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    RaisedOnSubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResolvedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RevisionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RevisionRequests_ThesisTopics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "ThesisTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RevisionRequests_TopicSubmissions_RaisedOnSubmissionId",
                        column: x => x.RaisedOnSubmissionId,
                        principalTable: "TopicSubmissions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RevisionRequests_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RevisionRequestLinks",
                columns: table => new
                {
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RevisionRequestLinks", x => new { x.SubmissionId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_RevisionRequestLinks_RevisionRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "RevisionRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RevisionRequestLinks_TopicSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "TopicSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RevisionRequestLinks_RequestId",
                table: "RevisionRequestLinks",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_RevisionRequests_CreatedById",
                table: "RevisionRequests",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_RevisionRequests_RaisedOnSubmissionId",
                table: "RevisionRequests",
                column: "RaisedOnSubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_RevisionRequests_TopicId_ResolvedAt",
                table: "RevisionRequests",
                columns: new[] { "TopicId", "ResolvedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TopicSubmissions_SubmittedById",
                table: "TopicSubmissions",
                column: "SubmittedById");

            migrationBuilder.CreateIndex(
                name: "IX_TopicSubmissions_TopicId_Kind_VersionNo",
                table: "TopicSubmissions",
                columns: new[] { "TopicId", "Kind", "VersionNo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RevisionRequestLinks");

            migrationBuilder.DropTable(
                name: "RevisionRequests");

            migrationBuilder.DropTable(
                name: "TopicSubmissions");

            migrationBuilder.DropColumn(
                name: "OutlineApprovedAt",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "OutlineApprovedById",
                table: "ThesisTopics");

            migrationBuilder.DropColumn(
                name: "OutlineApprovedSubmissionId",
                table: "ThesisTopics");
        }
    }
}
