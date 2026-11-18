using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace CineCompass.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261118120000_WatchedMovies")]
public sealed class WatchedMovies : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        Rename(migrationBuilder, "cinecompass_hidden_movies", "cinecompass_watched_movies");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        Rename(migrationBuilder, "cinecompass_watched_movies", "cinecompass_hidden_movies");

    // The settings object stores each preference as a JSON string. Move the value intact.
    private static void Rename(MigrationBuilder migrationBuilder, string from, string to) =>
        migrationBuilder.Sql($"""
            UPDATE "Settings"
            SET "Json" = ("Json" - '{from}') ||
                jsonb_build_object('{to}', COALESCE("Json" -> '{to}', "Json" -> '{from}')),
                "Revision" = "Revision" + 1
            WHERE "Json" ? '{from}';
            """);
}
