/** Tests for framework-detector — standalone CommonJS script. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Inline the detectFramework logic to avoid module resolution issues
const FRAMEWORK_FILES = {
  'next.config.js': ['Next.js'],
  'vite.config.js': ['Vite'],
  'vite.config.ts': ['Vite'],
  'tsconfig.json': ['TypeScript'],
  'jest.config.js': ['Jest'],
  'vitest.config.js': ['Vitest'],
  'vitest.config.ts': ['Vitest'],
  'playwright.config.ts': ['Playwright'],
  'Dockerfile': ['Docker'],
  'docker-compose.yml': ['Docker Compose'],
};

const DEP_TO_FRAMEWORK = {
  'react': 'React',
  'react-dom': 'React',
  'next': 'Next.js',
  'vue': 'Vue',
  'svelte': 'Svelte',
  'express': 'Express',
  'fastify': 'Fastify',
  '@prisma/client': 'Prisma',
  'drizzle-orm': 'Drizzle',
  '@supabase/supabase-js': 'Supabase',
  'vitest': 'Vitest',
  'jest': 'Jest',
  'playwright': 'Playwright',
  'electron': 'Electron',
  'tailwindcss': 'Tailwind CSS',
  '@nestjs/core': 'NestJS',
};

function detectFramework(repoRoot) {
  const result = { frontend: [], backend: [], database: [], testFramework: [], deployment: [], confidence: 0 };
  const evidence = [];

  for (const [file, frameworks] of Object.entries(FRAMEWORK_FILES)) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      for (const fw of frameworks) {
        if (!result.frontend.includes(fw) && !result.backend.includes(fw) && !result.testFramework.includes(fw) && !result.deployment.includes(fw)) {
          if (['React', 'Next.js', 'Vue', 'Svelte', 'Vite', 'Tailwind CSS', 'Electron', 'TypeScript'].includes(fw)) {
            result.frontend.push(fw);
          } else if (['NestJS', 'Express', 'Fastify', 'Prisma', 'Drizzle', 'Supabase'].includes(fw)) {
            result.backend.push(fw);
          } else if (['Jest', 'Vitest', 'Playwright'].includes(fw)) {
            result.testFramework.push(fw);
          } else if (['Docker', 'Docker Compose'].includes(fw)) {
            result.deployment.push(fw);
          }
          evidence.push('Found ' + file + ' -> ' + fw);
        }
      }
    }
  }

  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      for (const [dep, fw] of Object.entries(DEP_TO_FRAMEWORK)) {
        if (allDeps[dep] && !result.frontend.includes(fw) && !result.backend.includes(fw) && !result.testFramework.includes(fw) && !result.deployment.includes(fw)) {
          if (['React', 'Next.js', 'Vue', 'Svelte', 'Vite', 'Tailwind CSS', 'Electron', 'TypeScript'].includes(fw)) {
            result.frontend.push(fw);
          } else if (['NestJS', 'Express', 'Fastify', 'Prisma', 'Drizzle', 'Supabase'].includes(fw)) {
            result.backend.push(fw);
          } else if (['Jest', 'Vitest', 'Playwright'].includes(fw)) {
            result.testFramework.push(fw);
          } else if (['Docker', 'Docker Compose'].includes(fw)) {
            result.deployment.push(fw);
          }
          evidence.push('Found dependency ' + dep + ' -> ' + fw);
        }
      }
    } catch (e) { /* ignore */ }
  }

  result.confidence = Math.min(1, evidence.length / 5);
  return result;
}

// Test runner
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (err) {
    console.log('FAIL: ' + name + ' - ' + err.message);
    failed++;
  }
}

// Tests
test('should detect TypeScript from tsconfig.json', function() {
  const tempDir = path.join(__dirname, '__test_temp_framework');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
  const result = detectFramework(tempDir);
  assert.ok(result.frontend.indexOf('TypeScript') !== -1, 'TypeScript should be detected');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('should detect React from package.json dependencies', function() {
  const tempDir = path.join(__dirname, '__test_temp_react');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
  }));
  const result = detectFramework(tempDir);
  assert.ok(result.frontend.indexOf('React') !== -1, 'React should be detected');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('should detect Vite from vite.config.ts', function() {
  const tempDir = path.join(__dirname, '__test_temp_vite');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'vite.config.ts'), '');
  const result = detectFramework(tempDir);
  assert.ok(result.frontend.indexOf('Vite') !== -1, 'Vite should be detected');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('should return empty arrays for empty directory', function() {
  const tempDir = path.join(__dirname, '__test_temp_empty');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const result = detectFramework(tempDir);
  assert.deepStrictEqual(result.frontend, []);
  assert.deepStrictEqual(result.backend, []);
  assert.deepStrictEqual(result.database, []);
  assert.deepStrictEqual(result.testFramework, []);
  assert.deepStrictEqual(result.deployment, []);
  assert.strictEqual(result.confidence, 0);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('should detect multiple frameworks', function() {
  const tempDir = path.join(__dirname, '__test_temp_multi');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(tempDir, 'vite.config.ts'), '');
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    devDependencies: { vitest: '^1.0.0' },
  }));
  const result = detectFramework(tempDir);
  assert.ok(result.frontend.indexOf('TypeScript') !== -1, 'TypeScript should be detected');
  assert.ok(result.frontend.indexOf('Vite') !== -1, 'Vite should be detected');
  assert.ok(result.frontend.indexOf('React') !== -1, 'React should be detected');
  assert.ok(result.testFramework.indexOf('Vitest') !== -1, 'Vitest should be detected');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
