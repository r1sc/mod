import esbuild from "esbuild"

const ctx = await esbuild.context({
    entryPoints: ["src/main.ts", "src/paula_processor.ts"],
    bundle: true,
    outdir: "www/dist",
    sourcemap: true,
    sourceRoot:"src",
    logLevel: "info"
});

await ctx.serve({
    servedir: "www"
});
await ctx.watch();