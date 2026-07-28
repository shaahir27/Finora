import { PrismaClient } from "@smart-school/db";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function run() {
  console.log("🔒 Enabling RLS policies on Supabase PostgreSQL...");

  const sqlPath = path.join(process.cwd(), "prisma", "migrations", "20260727000001_enable_rls_policies", "migration.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Parse SQL statements handling dollar-quoted functions correctly
  const statements = [];
  let current = "";
  let inDollarQuote = false;

  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollarQuote) continue;

    if (trimmed.includes("$$")) {
      inDollarQuote = !inDollarQuote;
    }

    current += line + "\n";

    if (trimmed.endsWith(";") && !inDollarQuote) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = "";
    }
  }
  if (current.trim()) statements.push(current.trim());

  let successCount = 0;
  for (const statement of statements) {
    if (!statement || statement.startsWith("--")) continue;
    try {
      await prisma.$executeRawUnsafe(statement);
      successCount++;
    } catch (err) {
      console.error(`❌ Statement Error: ${err.message || err}\nSQL: ${statement.substring(0, 80)}...`);
    }
  }

  console.log(`✅ RLS Migration Complete! Successfully executed ${successCount}/${statements.length} SQL statements.`);
}

run()
  .catch((e) => {
    console.error("❌ Failed to apply RLS:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
