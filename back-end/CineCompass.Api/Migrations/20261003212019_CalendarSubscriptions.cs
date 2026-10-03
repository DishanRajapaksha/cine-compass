using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CineCompass.Api.Migrations;

/// <inheritdoc />
public partial class _20261003212019_CalendarSubscriptions : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CalendarSubscriptions",
            columns: table => new
            {
                UserId = table.Column<string>(type: "text", nullable: false),
                TokenHash = table.Column<string>(type: "text", nullable: false),
                ProtectedToken = table.Column<string>(type: "text", nullable: false),
                ReminderMinutes = table.Column<int>(type: "integer", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Revision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CalendarSubscriptions", x => x.UserId);
                table.ForeignKey(
                    name: "FK_CalendarSubscriptions_AspNetUsers_UserId",
                    column: x => x.UserId,
                    principalTable: "AspNetUsers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CalendarSubscriptions_TokenHash",
            table: "CalendarSubscriptions",
            column: "TokenHash",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "CalendarSubscriptions");
    }
}
