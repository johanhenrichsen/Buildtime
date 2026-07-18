#!/usr/bin/env node
'use strict';
// Vercel exposes VERCEL_PROJECT_ID at build time. Both the kiosk and
// admin projects share this repo root, so we dispatch to the right
// app directory based on which project is building.
const { execSync } = require('child_process');
const { cpSync, mkdirSync } = require('fs');

const ADMIN_PROJECT_ID = 'prj_3YFMSKLXZkOJmEBiZuX8mHwOgO9u';
const projectId = process.env.VERCEL_PROJECT_ID;
const isAdmin = projectId === ADMIN_PROJECT_ID;
const appDir = isAdmin ? 'apps/admin' : 'apps/kiosk';

console.log(`[dispatch-build] project=${projectId} → building ${isAdmin ? 'admin' : 'kiosk'} from ${appDir}/`);

execSync(`cd ${appDir} && npm install && npm run build`, { stdio: 'inherit' });

mkdirSync('dist', { recursive: true });
cpSync(`${appDir}/dist`, 'dist', { recursive: true });

console.log(`[dispatch-build] done — output copied to dist/`);
