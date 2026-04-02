import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'basic-ftp';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const phpApiDir = path.join(projectRoot, 'public', 'api');
const deployEnvPath = path.join(projectRoot, '.env.deploy.local');
const hostEnvPath = path.join(projectRoot, '.env.host.local');

loadEnv({ path: deployEnvPath });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  await access(distDir, constants.R_OK);
  await access(phpApiDir, constants.R_OK);
  const hostEnvExists = await access(hostEnvPath, constants.R_OK).then(() => true).catch(() => false);

  const host = requireEnv('FTP_HOST');
  const user = requireEnv('FTP_USER');
  const password = requireEnv('FTP_PASSWORD');
  const remoteDir = process.env.FTP_REMOTE_DIR?.trim() || 'public_html';
  const port = Number(process.env.FTP_PORT?.trim() || '21');
  const secure = (process.env.FTP_SECURE?.trim() || 'true').toLowerCase() !== 'false';

  if (Number.isNaN(port)) {
    throw new Error('FTP_PORT must be a valid number');
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    console.log(`Connecting to ${host}:${port} (${secure ? 'FTPS' : 'FTP'})`);
    await client.access({
      host,
      user,
      password,
      port,
      secure,
    });

    await client.cd('/');
    await client.ensureDir(remoteDir);
    await client.cd(`/${remoteDir}`);
    // Upload dist files directly without clearing (avoids FTP permission issues)
    await client.uploadFromDir(distDir);

    await client.ensureDir('api');
    await client.cd(`/${remoteDir}/api`);
    // Upload PHP files directly
    await client.uploadFromDir(phpApiDir);

    if (hostEnvExists) {
      await client.uploadFrom(hostEnvPath, `/${remoteDir}/.env.local`);
    }
    console.log(`Deploy complete: ${distDir} -> ${remoteDir}`);
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Deploy failed: ${message}`);
  process.exit(1);
});
