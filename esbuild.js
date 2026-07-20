const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

function copyMedia() {
  const srcDir = path.join(__dirname, "media");
  const outDir = path.join(__dirname, "dist", "media");
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, file);
    const dst = path.join(outDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dst);
    }
  }
}

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "warning",
  });

  if (watch) {
    copyMedia();
    // Re-copy media on change during watch
    const mediaDir = path.join(__dirname, "media");
    if (fs.existsSync(mediaDir)) {
      fs.watch(mediaDir, { recursive: false }, () => copyMedia());
    }
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    copyMedia();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
