using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api;

internal sealed class KeycloakAccounts(AppDbContext db, UserManager<AppUser> users)
{
    public async Task<AppUser> Resolve(string issuer, string subject, CancellationToken cancellation)
    {
        // The issuer and subject are taken from a validated OIDC response.
        // Usernames are display data and are never used to claim an existing account.
        var existing = await users.FindByLoginAsync(issuer, subject);
        if (existing is not null) return existing;

        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(issuer + "\n" + subject)));
        await using (var transaction = await db.Database.BeginTransactionAsync(cancellation))
        {
            var user = new AppUser { UserName = $"heimdall-{digest}" };
            try
            {
                if ((await users.CreateAsync(user)).Succeeded &&
                    (await users.AddLoginAsync(user, new UserLoginInfo(issuer, subject, "Heimdall"))).Succeeded)
                {
                    await transaction.CommitAsync(cancellation);
                    return user;
                }
            }
            catch (DbUpdateException)
            {
                // Another callback may have inserted this subject during the transaction.
            }
        }

        db.ChangeTracker.Clear();
        return await users.FindByLoginAsync(issuer, subject)
            ?? throw new InvalidOperationException("Could not create the Heimdall account link.");
    }
}
