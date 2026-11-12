using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Data.Migrations;

// PDR-012: bản ghi đề xuất Đã hủy giữ GroupId để tra cứu, nhưng không thể giữ chỉ mục
// unique toàn phần vì nhóm phải được đề xuất lại với chính GroupId đó.
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261110090000_EnableProposalResubmission")]
public partial class EnableProposalResubmission : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_ThesisTopics_GroupId", table: "ThesisTopics");
        migrationBuilder.CreateIndex(
            name: "IX_ThesisTopics_ActiveGroupId",
            table: "ThesisTopics",
            column: "GroupId",
            unique: true,
            filter: "\"GroupId\" IS NOT NULL AND \"Status\" IN ('PendingApproval', 'Registered', 'Rejected')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_ThesisTopics_ActiveGroupId", table: "ThesisTopics");
        migrationBuilder.CreateIndex(name: "IX_ThesisTopics_GroupId", table: "ThesisTopics", column: "GroupId", unique: true);
    }
}
