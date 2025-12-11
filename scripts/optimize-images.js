#!/usr/bin/env node

/**
 * Image Optimization Script - Convert JPG/JPEG/PNG to WebP
 *
 * Usage:
 *   node scripts/optimize-images.js <source> [--output <target>]
 *
 * Examples:
 *   pnpm optimize:images ./assets
 *   pnpm optimize:images ./assets/avatar.jpg
 *   pnpm optimize:images ./assets --output ./optimized
 *   pnpm optimize:images ./assets/avatar.jpg --output ./optimized/avatar.webp
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";

// Supported image extensions
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"];

// WebP compression quality (0-100)
const WEBP_QUALITY = 80;

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { source: null, output: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      result.output = args[i + 1];
      i++;
    } else if (!result.source) {
      result.source = args[i];
    }
  }

  return result;
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculate compression rate
 */
function calculateCompressionRate(originalSize, newSize) {
  return (((originalSize - newSize) / originalSize) * 100).toFixed(1);
}

/**
 * Get output path for a file
 */
function getOutputPath(inputPath, sourcePath, outputPath) {
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);

  if (!outputPath) {
    // No output specified, replace in place
    return path.join(path.dirname(inputPath), `${baseName}.webp`);
  }

  // Check if output is a file or directory
  const outputExt = path.extname(outputPath);
  if (outputExt === ".webp") {
    // Output is a file
    return outputPath;
  }

  // Output is a directory, preserve relative path structure
  const sourceDir = fs.statSync(sourcePath).isDirectory()
    ? sourcePath
    : path.dirname(sourcePath);
  const relativePath = path.relative(sourceDir, inputPath);
  const relativeDir = path.dirname(relativePath);
  const targetDir = path.join(outputPath, relativeDir);

  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return path.join(targetDir, `${baseName}.webp`);
}

/**
 * Optimize single image file
 */
async function optimizeImage(filePath, sourcePath, outputPath, deleteOriginal) {
  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return null;
  }

  const targetPath = getOutputPath(filePath, sourcePath, outputPath);

  // Get original file size
  const originalStats = fs.statSync(filePath);
  const originalSize = originalStats.size;

  try {
    // Convert to WebP
    await sharp(filePath).webp({ quality: WEBP_QUALITY }).toFile(targetPath);

    // Get new file size
    const newStats = fs.statSync(targetPath);
    const newSize = newStats.size;

    // Delete original file only if no output path specified (in-place replacement)
    if (deleteOriginal) {
      fs.unlinkSync(filePath);
    }

    return {
      original: filePath,
      output: targetPath,
      originalSize,
      newSize,
      compressionRate: calculateCompressionRate(originalSize, newSize),
    };
  } catch (error) {
    console.error(`[ERROR] Failed to convert: ${filePath}`, error.message);
    return null;
  }
}

/**
 * Recursively get all image files in directory
 */
function getAllImageFiles(dirPath, files = []) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllImageFiles(fullPath, files);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Print results table
 */
function printTable(results) {
  // Table header
  const headers = ["File", "Original", "Optimized", "Saved", "Ratio"];
  const colWidths = [45, 12, 12, 12, 8];

  const separator =
    "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerRow =
    "|" + headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join("|") + "|";

  console.log("\n" + separator);
  console.log(headerRow);
  console.log(separator);

  for (const r of results) {
    const relativePath = path.relative(process.cwd(), r.original);
    const displayPath =
      relativePath.length > colWidths[0]
        ? "..." + relativePath.slice(-(colWidths[0] - 3))
        : relativePath;

    const saved = formatSize(r.originalSize - r.newSize);

    const row =
      "|" +
      [
        ` ${displayPath.padEnd(colWidths[0])} `,
        ` ${formatSize(r.originalSize).padEnd(colWidths[1])} `,
        ` ${formatSize(r.newSize).padEnd(colWidths[2])} `,
        ` ${saved.padEnd(colWidths[3])} `,
        ` ${(r.compressionRate + "%").padEnd(colWidths[4])} `,
      ].join("|") +
      "|";

    console.log(row);
  }

  console.log(separator);
}

/**
 * Main function
 */
async function main() {
  const { source, output } = parseArgs();

  if (!source) {
    console.error("[ERROR] Please provide a source path or file");
    console.log("\nUsage: pnpm optimize:images <source> [--output <target>]");
    console.log("\nExamples:");
    console.log("  pnpm optimize:images ./assets");
    console.log("  pnpm optimize:images ./assets --output ./optimized");
    process.exit(1);
  }

  const absoluteSource = path.resolve(source);

  if (!fs.existsSync(absoluteSource)) {
    console.error(`[ERROR] Path not found: ${absoluteSource}`);
    process.exit(1);
  }

  const stat = fs.statSync(absoluteSource);
  let files = [];
  const deleteOriginal = !output; // Only delete original if no output path specified

  if (stat.isDirectory()) {
    files = getAllImageFiles(absoluteSource);
    console.log(`\n[INFO] Source: ${absoluteSource}`);
    if (output) {
      console.log(`[INFO] Output: ${path.resolve(output)}`);
    }
    console.log(`[INFO] Found ${files.length} image(s) to optimize\n`);
  } else {
    files = [absoluteSource];
    console.log(`\n[INFO] File: ${absoluteSource}`);
    if (output) {
      console.log(`[INFO] Output: ${path.resolve(output)}`);
    }
  }

  if (files.length === 0) {
    console.log("[INFO] No images to optimize");
    return;
  }

  const results = [];

  for (const file of files) {
    const result = await optimizeImage(
      file,
      absoluteSource,
      output,
      deleteOriginal
    );
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    printTable(results);

    // Summary
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginal - totalNew;

    console.log("\n[SUMMARY]");
    console.log(`  Files converted : ${results.length}`);
    console.log(`  Original size   : ${formatSize(totalOriginal)}`);
    console.log(`  Optimized size  : ${formatSize(totalNew)}`);
    console.log(
      `  Space saved     : ${formatSize(
        totalSaved
      )} (${calculateCompressionRate(totalOriginal, totalNew)}%)\n`
    );
  }
}

main().catch(console.error);
