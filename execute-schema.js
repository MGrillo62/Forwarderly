const { execSync } = require('child_process');

console.log("Pushing and generating Prisma schema in GestordeVentas...");
try {
  execSync('npx prisma db push', { cwd: 'c:\\Users\\USUARIO\\OneDrive\\Documents\\GestordeVentas\\server', stdio: 'inherit' });
  execSync('npx prisma generate', { cwd: 'c:\\Users\\USUARIO\\OneDrive\\Documents\\GestordeVentas\\server', stdio: 'inherit' });
  console.log("Executed successfully.");
} catch (err) {
  console.error("Error:", err.message);
}
