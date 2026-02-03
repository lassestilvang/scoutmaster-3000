import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading from current directory
dotenv.config();

// In a monorepo setup, the .env might be in the project root
// We check if we're in the 'backend' folder and look one level up
const cwd = process.cwd();
if (!process.env.GRID_API_KEY) {
    const rootEnvPath = path.resolve(cwd, '..', '.env');
    if (fs.existsSync(rootEnvPath)) {
        dotenv.config({ path: rootEnvPath });
    }
}

// Fallback: also check if we are running from root but need the .env in root
if (!process.env.GRID_API_KEY) {
    const localEnvPath = path.resolve(cwd, '.env');
    if (fs.existsSync(localEnvPath)) {
        dotenv.config({ path: localEnvPath });
    }
}
