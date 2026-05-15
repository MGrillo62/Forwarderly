const { execSync } = require('child_process');

console.log("Building client in GestordeVentas...");
try {
  const output = execSync('npm run build', { cwd: 'c:\\Users\\USUARIO\\OneDrive\\Documents\\GestordeVentas\\client', stdio: 'pipe' });
  console.log(output.toString());
  console.log("Client build executed successfully.");
} catch (err) {
  console.error("Error running client build:");
  console.error(err.stdout ? err.stdout.toString() : err.message);
  console.error(err.stderr ? err.stderr.toString() : '');
}
