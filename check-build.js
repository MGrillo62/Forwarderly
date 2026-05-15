const { execSync } = require('child_process');

console.log("Building server in GestordeVentas...");
try {
  const output = execSync('npm run build', { cwd: 'c:\\Users\\USUARIO\\OneDrive\\Documents\\GestordeVentas\\server', stdio: 'pipe' });
  console.log(output.toString());
  console.log("Build executed successfully.");
} catch (err) {
  console.error("Error running build:");
  console.error(err.stdout ? err.stdout.toString() : err.message);
  console.error(err.stderr ? err.stderr.toString() : '');
}
