const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Vercel build...');

try {
  // Generar Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Build de NestJS
  console.log('🔨 Building NestJS application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Crear directorio public si no existe
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  // Crear archivo de entrada en public
  const entryFile = path.join(publicDir, 'index.js');
  const apiFile = path.join(__dirname, 'api', 'index.ts');
  
  if (fs.existsSync(apiFile)) {
    // Copiar el contenido del archivo api/index.ts
    const content = fs.readFileSync(apiFile, 'utf8');
    fs.writeFileSync(entryFile, content);
    console.log('✅ Entry file created in public directory');
  }
  
  console.log('🎉 Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
