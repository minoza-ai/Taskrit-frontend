#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

// Parse .env file
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, value] = trimmed.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }
  });
  
  return env;
}

const env = parseEnv(envPath);
const apiProd = env.VITE_API_PROD

const vercelConfig = {
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${apiProd}/:path*`,
    },
    {
      source: '/(.*)',
      destination: '/index.html',
    },
  ],
};

const outputPath = path.join(__dirname, '..', 'vercel.json');
fs.writeFileSync(outputPath, JSON.stringify(vercelConfig, null, 2));
console.log(`✓ vercel.json generated with API URL: ${apiProd}`);
