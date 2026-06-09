const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

// List of tables belonging to the other application that we must not touch
const UNRELATED_TABLES = [
  'campuses', 'classrooms', 'courses', 'credit_pricing', 'enrollments',
  'ledger_accounts', 'ledger_entries', 'ledger_lines', 'menu_options',
  'payables', 'professor_attendance', 'professor_availabilities', 'professors',
  'receivables', 'role_menu_permissions', 'roles', 'schedules',
  'student_guardians', 'students', 'tenants', 'time_slots', 'transactions',
  'users', 'audit_logs'
];

async function main() {
  console.log("Generating schema diff SQL...");
  
  let sqlScript = "";
  try {
    // Run the prisma migrate diff command programmatically to get a UTF-8 string
    sqlScript = execSync(
      'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );
  } catch (err) {
    console.error("Error generating diff SQL:", err.message);
    return;
  }

  // Split SQL into individual statements
  const rawStatements = sqlScript.split(';');
  const filteredStatements = [];

  for (const rawStmt of rawStatements) {
    const stmt = rawStmt.trim();
    if (!stmt) continue;

    // Check if it's a comment or unrelated query
    const stmtLower = stmt.toLowerCase();
    
    // Check if the statement drops or modifies any unrelated table
    let isUnrelated = false;
    for (const tbl of UNRELATED_TABLES) {
      if (stmtLower.includes(`"${tbl.toLowerCase()}"`) || stmtLower.includes(` ${tbl.toLowerCase()} `) || stmtLower.includes(` ${tbl.toLowerCase()};`)) {
        isUnrelated = true;
        break;
      }
    }

    if (isUnrelated) {
      console.log(`- Skipping statement referencing unrelated table: ${stmt.substring(0, 100)}...`);
      continue;
    }

    if (stmtLower.includes("drop table")) {
      console.log(`- Skipping DROP TABLE statement: ${stmt}`);
      continue;
    }

    filteredStatements.push(stmt);
  }

  console.log(`\nPrepared ${filteredStatements.length} safe SQL statements for execution.`);

  for (let i = 0; i < filteredStatements.length; i++) {
    const stmt = filteredStatements[i];
    console.log(`\n[Statement ${i+1}/${filteredStatements.length}]:`);
    console.log(stmt);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log("--> SUCCESS");
    } catch (err) {
      console.log(`--> WARNING/ERROR: ${err.message}`);
    }
  }

  console.log("\nDatabase schema synchronization completed!");
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
