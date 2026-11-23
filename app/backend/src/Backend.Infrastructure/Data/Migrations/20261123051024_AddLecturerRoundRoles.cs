using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLecturerRoundRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsCommittee",
                table: "RoundParticipants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsReviewer",
                table: "RoundParticipants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSupervisor",
                table: "RoundParticipants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.Sql("UPDATE \"RoundParticipants\" SET \"IsSupervisor\" = true, \"IsReviewer\" = true, \"IsCommittee\" = true WHERE \"Kind\" = 'Lecturer';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsCommittee",
                table: "RoundParticipants");

            migrationBuilder.DropColumn(
                name: "IsReviewer",
                table: "RoundParticipants");

            migrationBuilder.DropColumn(
                name: "IsSupervisor",
                table: "RoundParticipants");
        }
    }
}
