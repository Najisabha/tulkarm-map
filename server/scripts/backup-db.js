/**
 * تصدير قاعدة البيانات إلى ملف SQL نصي (.sql) في server/backups/
 *
 * التشغيل: npm run backup (من مجلد server) أو npm run backup:db (من جذر المشروع)
 * مخطط فقط (مناسب للنشر بدون بيانات تطوير): npm run backup:schema أو SCHEMA_ONLY=1 npm run backup
 *
 * تحديد موقع pg_dump:
 * - متغير PG_DUMP = مسار كامل لـ pg_dump.exe / pg_dump
 * - أو PG_BIN = مجلد bin الخاص بـ PostgreSQL
 * - أو إضافة مجلد bin إلى PATH
 * - على Windows: يُبحث تلقائياً في Program Files\PostgreSQL\<إصدار>\bin
 */

import { spawn } from 'child_process';
import { constants } from 'fs';
import { access, mkdir, readdir } from 'fs/promises';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL?.trim();

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function findPgDumpWindows() {
  const roots = [
    join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'PostgreSQL'),
  ];
  const versions = [];
  for (const root of roots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const ver = parseInt(e.name, 10);
        if (Number.isNaN(ver)) continue;
        versions.push({
          ver,
          exe: join(root, e.name, 'bin', 'pg_dump.exe'),
        });
      }
    } catch {
      // المجلد غير موجود
    }
  }
  versions.sort((a, b) => b.ver - a.ver);
  for (const { exe } of versions) {
    try {
      await access(exe, constants.F_OK);
      return exe;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolvePgDump() {
  const explicit = process.env.PG_DUMP?.trim();
  if (explicit) {
    try {
      await access(explicit, constants.F_OK);
    } catch {
      throw new Error(`PG_DUMP غير موجود: ${explicit}`);
    }
    return explicit;
  }

  const pgBin = process.env.PG_BIN?.trim();
  if (pgBin) {
    const name = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
    const bin = join(pgBin, name);
    try {
      await access(bin, constants.F_OK);
    } catch {
      throw new Error(`لا يوجد pg_dump تحت PG_BIN: ${bin}`);
    }
    return bin;
  }

  if (process.platform === 'win32') {
    const found = await findPgDumpWindows();
    if (found) return found;
  }

  return 'pg_dump';
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL غير موجود في server/.env');
    process.exit(1);
  }

  let pgDumpBin;
  try {
    pgDumpBin = await resolvePgDump();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  const backupsDir = join(__dirname, '../backups');
  await mkdir(backupsDir, { recursive: true });

  const filename = `tulkarm-map-${stamp()}.sql`;
  const outPath = join(backupsDir, filename);

  const schemaOnly =
    process.env.SCHEMA_ONLY === '1' ||
    process.env.SCHEMA_ONLY === 'true' ||
    process.argv.includes('--schema-only');

  const args = [
    DATABASE_URL,
    '--format=plain',
    '--encoding=UTF8',
    '--no-owner',
    '--no-acl',
    '--file',
    outPath,
  ];
  if (schemaOnly) {
    args.splice(1, 0, '--schema-only');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(pgDumpBin, args, { stdio: 'inherit' });
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            [
              'لم يُعثر على pg_dump.',
              'ثبّت PostgreSQL (يشمل أدوات العميل) أو عيّن PG_DUMP أو PG_BIN في البيئة،',
              'أو أضف مجلد bin إلى PATH.',
            ].join(' '),
          ),
        );
      } else {
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump انتهى بالرمز ${code}`));
    });
  });

  console.log(
    schemaOnly
      ? `تم حفظ مخطط القاعدة فقط (بدون بيانات): ${outPath}`
      : `تم حفظ ملف SQL: ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
