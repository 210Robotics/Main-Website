import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const guildId = process.env.DISCORD_GUILD_ID;

if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
if (!guildId || !/^\d{15,22}$/.test(guildId)) {
  throw new Error("DISCORD_GUILD_ID must be a valid numeric Discord Server ID.");
}

async function main() {
  const sql = neon(databaseUrl!);
  await sql.query(
    `insert into discord_guilds (id, name, updated_at)
     values ($1, $2, now())
     on conflict (id) do update
     set name = excluded.name, updated_at = now()`,
    [guildId, "210 Robotics Discord"],
  );
  console.log(`Discord server ${guildId} is linked to the website database.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
