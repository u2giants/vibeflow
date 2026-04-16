/**
 * FrameworkDetector — identifies likely stack components from file patterns
 * and package.json analysis. Detection results are exposed as evidence,
 * not hidden guesses.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DetectedStack } from '../shared-types';

/** Framework detection rules: file pattern → framework name. */
const FRAMEWORK_FILES: Record<string, string[]> = {
  'next.config.js': ['Next.js'],
  'next.config.mjs': ['Next.js'],
  'next.config.ts': ['Next.js'],
  'vite.config.js': ['Vite'],
  'vite.config.ts': ['Vite'],
  'nuxt.config.js': ['Nuxt'],
  'nuxt.config.ts': ['Nuxt'],
  'svelte.config.js': ['Svelte'],
  'angular.json': ['Angular'],
  'vue.config.js': ['Vue'],
  'tailwind.config.js': ['Tailwind CSS'],
  'tailwind.config.ts': ['Tailwind CSS'],
  'postcss.config.js': ['PostCSS'],
  'jest.config.js': ['Jest'],
  'jest.config.ts': ['Jest'],
  'vitest.config.js': ['Vitest'],
  'vitest.config.ts': ['Vitest'],
  'playwright.config.js': ['Playwright'],
  'playwright.config.ts': ['Playwright'],
  'cypress.config.js': ['Cypress'],
  'cypress.config.ts': ['Cypress'],
  'Dockerfile': ['Docker'],
  'docker-compose.yml': ['Docker Compose'],
  'docker-compose.yaml': ['Docker Compose'],
  'prisma/schema.prisma': ['Prisma'],
  'drizzle.config.ts': ['Drizzle'],
  'typeorm.config.ts': ['TypeORM'],
  'sequelize.config.js': ['Sequelize'],
  'electron.vite.config.ts': ['Electron'],
  'electron-builder.yml': ['Electron Builder'],
  'electron-builder.yaml': ['Electron Builder'],
  'tsconfig.json': ['TypeScript'],
  'nest-cli.json': ['NestJS'],
  'serverless.yml': ['Serverless Framework'],
  'serverless.yaml': ['Serverless Framework'],
  'coolify.yml': ['Coolify'],
  'coolify.yaml': ['Coolify'],
};

/** Dependency name → framework name mapping. */
const DEP_TO_FRAMEWORK: Record<string, string> = {
  'react': 'React',
  'react-dom': 'React',
  'next': 'Next.js',
  'vue': 'Vue',
  'svelte': 'Svelte',
  '@angular/core': 'Angular',
  'express': 'Express',
  'fastify': 'Fastify',
  'hono': 'Hono',
  'koa': 'Koa',
  '@prisma/client': 'Prisma',
  'drizzle-orm': 'Drizzle',
  'typeorm': 'TypeORM',
  'sequelize': 'Sequelize',
  'mongoose': 'Mongoose',
  '@supabase/supabase-js': 'Supabase',
  'firebase': 'Firebase',
  'vitest': 'Vitest',
  'jest': 'Jest',
  'playwright': 'Playwright',
  'cypress': 'Cypress',
  'electron': 'Electron',
  'electron-builder': 'Electron Builder',
  'tailwindcss': 'Tailwind CSS',
  'nestjs': 'NestJS',
  '@nestjs/core': 'NestJS',
};

/** Backend runtime indicators. */
const BACKEND_INDICATORS: Record<string, string[]> = {
  'requirements.txt': ['Python'],
  'go.mod': ['Go'],
  'Cargo.toml': ['Rust'],
  'Gemfile': ['Ruby'],
  'pom.xml': ['Java'],
  'build.gradle': ['Java/Gradle'],
  'package.json': ['Node.js'],
  'bun.lockb': ['Bun'],
};

/** Database indicators. */
const DATABASE_INDICATORS: Record<string, string[]> = {
  'prisma/schema.prisma': ['Prisma (ORM)'],
  'drizzle.config.ts': ['Drizzle (ORM)'],
  'migrations/': ['Database Migrations'],
  'db/': ['Database'],
};

/** Detect frameworks from a project root. */
export function detectFramework(repoRoot: string): DetectedStack {
  const result: DetectedStack = {
    frontend: [],
    backend: [],
    database: [],
    testFramework: [],
    deployment: [],
    confidence: 0,
  };

  const evidence: string[] = [];

  // Check for framework-specific files
  for (const [file, frameworks] of Object.entries(FRAMEWORK_FILES)) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      for (const fw of frameworks) {
        if (!result.frontend.includes(fw) && !result.backend.includes(fw) && !result.testFramework.includes(fw) && !result.deployment.includes(fw)) {
          // Categorize
          if (['React', 'Next.js', 'Vue', 'Svelte', 'Angular', 'Vite', 'Tailwind CSS', 'PostCSS', 'Electron', 'Electron Builder'].includes(fw)) {
            result.frontend.push(fw);
          } else if (['NestJS', 'Express', 'Fastify', 'Hono', 'Koa', 'Prisma', 'Drizzle', 'TypeORM', 'Sequelize', 'Node.js', 'Bun'].includes(fw)) {
            result.backend.push(fw);
          } else if (['Jest', 'Vitest', 'Playwright', 'Cypress'].includes(fw)) {
            result.testFramework.push(fw);
          } else if (['Docker', 'Docker Compose', 'Coolify', 'Serverless Framework'].includes(fw)) {
            result.deployment.push(fw);
          }
          evidence.push(`Found ${file} → ${fw}`);
        }
      }
    }
  }

  // Check for backend runtime indicators
  for (const [file, runtimes] of Object.entries(BACKEND_INDICATORS)) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      for (const rt of runtimes) {
        if (!result.backend.includes(rt)) {
          result.backend.push(rt);
          evidence.push(`Found ${file} → ${rt}`);
        }
      }
    }
  }

  // Check for database indicators
  for (const [file, dbs] of Object.entries(DATABASE_INDICATORS)) {
    const fullPath = path.join(repoRoot, file);
    if (fs.existsSync(fullPath)) {
      for (const db of dbs) {
        if (!result.database.includes(db)) {
          result.database.push(db);
          evidence.push(`Found ${file} → ${db}`);
        }
      }
    }
  }

  // Parse package.json dependencies
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const [dep, fw] of Object.entries(DEP_TO_FRAMEWORK)) {
        if (allDeps[dep] && !result.frontend.includes(fw) && !result.backend.includes(fw) && !result.testFramework.includes(fw) && !result.deployment.includes(fw)) {
          if (['React', 'Next.js', 'Vue', 'Svelte', 'Angular', 'Vite', 'Tailwind CSS', 'Electron', 'Electron Builder'].includes(fw)) {
            result.frontend.push(fw);
          } else if (['NestJS', 'Express', 'Fastify', 'Hono', 'Koa', 'Prisma', 'Drizzle', 'TypeORM', 'Sequelize', 'Node.js', 'Bun'].includes(fw)) {
            result.backend.push(fw);
          } else if (['Jest', 'Vitest', 'Playwright', 'Cypress'].includes(fw)) {
            result.testFramework.push(fw);
          } else if (['Docker', 'Docker Compose', 'Coolify', 'Serverless Framework'].includes(fw)) {
            result.deployment.push(fw);
          }
          evidence.push(`Found dependency ${dep} → ${fw}`);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Check for TypeScript vs JavaScript
  if (fs.existsSync(path.join(repoRoot, 'tsconfig.json'))) {
    if (!result.frontend.includes('TypeScript')) {
      result.frontend.push('TypeScript');
      evidence.push('Found tsconfig.json → TypeScript');
    }
  }

  // Calculate confidence based on evidence count
  result.confidence = Math.min(1, evidence.length / 5);

  return result;
}
