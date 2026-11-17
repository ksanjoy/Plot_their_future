import { existsSync } from 'node:fs';

// Must be the first import of every entrypoint: some modules read process.env
// while their decorators are evaluated. Variables already set in the process
// environment win over the file.
const file = process.env.ENV_FILE ?? '.env';
if (existsSync(file)) process.loadEnvFile(file);
