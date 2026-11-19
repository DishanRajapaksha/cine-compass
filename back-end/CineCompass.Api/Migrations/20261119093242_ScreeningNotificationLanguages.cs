using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CineCompass.Api.Migrations;

/// <inheritdoc />
public partial class _20261119093242_ScreeningNotificationLanguages : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string[]>(
            name: "AudioLanguages",
            table: "ScreeningNotifications",
            type: "text[]",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "AudioSource",
            table: "ScreeningNotifications",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "LanguageVersion",
            table: "ScreeningNotifications",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string[]>(
            name: "SubtitleLanguages",
            table: "ScreeningNotifications",
            type: "text[]",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SubtitleStatus",
            table: "ScreeningNotifications",
            type: "text",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_ScreeningNotifications_UserId_FoundAt",
            table: "ScreeningNotifications",
            columns: new[] { "UserId", "FoundAt" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_ScreeningNotifications_UserId_FoundAt",
            table: "ScreeningNotifications");

        migrationBuilder.DropColumn(
            name: "AudioLanguages",
            table: "ScreeningNotifications");

        migrationBuilder.DropColumn(
            name: "AudioSource",
            table: "ScreeningNotifications");

        migrationBuilder.DropColumn(
            name: "LanguageVersion",
            table: "ScreeningNotifications");

        migrationBuilder.DropColumn(
            name: "SubtitleLanguages",
            table: "ScreeningNotifications");

        migrationBuilder.DropColumn(
            name: "SubtitleStatus",
            table: "ScreeningNotifications");
    }
}
