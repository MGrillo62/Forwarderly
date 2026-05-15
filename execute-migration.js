const { execSync } = require('child_process');

console.log("Running data migration script in GestordeVentas...");
try {
  execSync('npx ts-node update-country-data.ts', { cwd: 'c:\\Users\\USUARIO\\OneDrive\\Documents\\GestordeVentas\\server', stdio: 'inherit' });
  console.log("Migration executed successfully.");
} catch (err) {
  console.error("Error running migration:", err.message);
}
