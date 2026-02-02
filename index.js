#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const DRY_RUN = process.env.DRY_RUN === '1';
const KEEP_OLD = process.env.KEEP_OLD === '1';

const log = (...args) => console.log('[reshape]', ...args);

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  if (DRY_RUN) return;
  await fsp.mkdir(p, { recursive: true });
}

async function moveDir(src, dest) {
  if (!(await exists(src))) return;
  await ensureDir(path.dirname(dest));

  if (DRY_RUN) {
    log(`move ${src} -> ${dest}`);
    return;
  }

  try {
    await fsp.rename(src, dest);
  } catch {
    await copyDir(src, dest);
    await removeDir(src);
  }
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      if (DRY_RUN) log(`copy ${s} -> ${d}`);
      else await fsp.copyFile(s, d);
    }
  }
}

async function removeDir(dir) {
  if (!(await exists(dir))) return;
  if (DRY_RUN) {
    log(`remove dir ${dir}`);
    return;
  }
  await fsp.rm(dir, { recursive: true, force: true });
}

function monthFromCreatedTime(createdTime) {
  if (!createdTime || createdTime.length < 7) return null;
  return createdTime.slice(0, 7).replace('-', '');
}

function sortByTimeDesc(a, b) {
  return String(b.createdTime).localeCompare(String(a.createdTime));
}

async function splitMemosJson() {
  const memosJson = path.join(ROOT, 'data', 'memos.json');
  if (!(await exists(memosJson))) return;

  const raw = await fsp.readFile(memosJson, 'utf8');
  let list = [];
  try {
    list = JSON.parse(raw);
  } catch {
    log('memos.json parse failed, skip');
    return;
  }

  const buckets = new Map();
  for (const memo of list) {
    const month = monthFromCreatedTime(memo.createdTime);
    if (!month) continue;
    if (!buckets.has(month)) buckets.set(month, []);
    buckets.get(month).push(memo);
  }

  const memosDir = path.join(ROOT, 'data', 'memos');
  await ensureDir(memosDir);

  for (const [month, memos] of buckets.entries()) {
    memos.sort(sortByTimeDesc);
    const file = path.join(memosDir, `memos-${month}.json`);
    if (DRY_RUN) {
      log(`write ${file} (${memos.length})`);
    } else {
      await fsp.writeFile(file, JSON.stringify(memos, null, 2));
    }
  }

  if (!KEEP_OLD) {
    if (DRY_RUN) log(`remove ${memosJson}`);
    else await fsp.unlink(memosJson);
  } else {
    log('KEEP_OLD=1, keep data/memos.json');
  }
}

async function main() {
  const postsDir = path.join(ROOT, 'posts');
  const dataPostsDir = path.join(ROOT, 'data', 'posts');
  if (await exists(postsDir)) {
    await moveDir(postsDir, dataPostsDir);
  }

  await splitMemosJson();

  const dataImagesDir = path.join(ROOT, 'data', 'images');
  await removeDir(dataImagesDir);

  log('done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
