using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CineCompass.Api.Migrations;

/// <inheritdoc />
public partial class _20261119000301_ScreeningNotifications : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ScreeningNotifications",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                UserId = table.Column<string>(type: "text", nullable: false),
                ScreeningId = table.Column<string>(type: "text", nullable: false),
                FilmId = table.Column<string>(type: "text", nullable: false),
                FilmTitle = table.Column<string>(type: "text", nullable: false),
                TheaterName = table.Column<string>(type: "text", nullable: false),
                TheaterCity = table.Column<string>(type: "text", nullable: false),
                TicketingUrl = table.Column<string>(type: "text", nullable: true),
                StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                FoundAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                IsRead = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ScreeningNotifications", x => x.Id);
                table.ForeignKey(
                    name: "FK_ScreeningNotifications_AspNetUsers_UserId",
                    column: x => x.UserId,
                    principalTable: "AspNetUsers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ScreeningNotificationScans",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false),
                CompletedDay = table.Column<DateOnly>(type: "date", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ScreeningNotificationScans", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ScreeningNotifications_UserId_Id",
            table: "ScreeningNotifications",
            columns: new[] { "UserId", "Id" });

        migrationBuilder.CreateIndex(
            name: "IX_ScreeningNotifications_UserId_IsRead",
            table: "ScreeningNotifications",
            columns: new[] { "UserId", "IsRead" });

        migrationBuilder.CreateIndex(
            name: "IX_ScreeningNotifications_UserId_ScreeningId",
            table: "ScreeningNotifications",
            columns: new[] { "UserId", "ScreeningId" },
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "ScreeningNotifications");

        migrationBuilder.DropTable(
            name: "ScreeningNotificationScans");
    }
}
