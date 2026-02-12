import solidPlugin from "@opentui/solid/bun-plugin";

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  plugins: [solidPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build succeeded, compiling binary...");

const proc = Bun.spawn(
  ["bun", "build", "dist/index.js", "--compile", "--outfile", "dist/crafters"],
  { stdout: "inherit", stderr: "inherit" }
);
await proc.exited;

if (proc.exitCode !== 0) {
  process.exit(proc.exitCode ?? 1);
}

console.log("Binary: dist/crafters");
