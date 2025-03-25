/* eslint-disable no-console */
import * as esbuild from "esbuild"
import { copy } from "esbuild-plugin-copy"
import fs from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"

const clientModuleGlob = new Bun.Glob("./src/components/islands/*/client.tsx")
// prettier-ignore
const islands = await Array.fromAsync(clientModuleGlob.scan(import.meta.dirname), async (clientModulePath) => {
    const coreModulePath = path.resolve(path.dirname(clientModulePath), "core.tsx")
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const coreModule: Record<string, unknown> = await import(coreModulePath)
    if (typeof coreModule.name === "string") {
        return [coreModule.name, clientModulePath] as const
    } else {
        throw new Error(`Module '${coreModulePath}' does not have an export 'name' of type string.`)
    }
})
const { values } = parseArgs({
    args: Bun.argv,
    options: {
        watch: {
            type: "boolean",
        },
        dev: {
            type: "boolean",
        },
    },
    strict: true,
    allowPositionals: true,
})
const buildOptions = {
    entryPoints: Object.fromEntries(islands),
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: true,
    treeShaking: true,
    outdir: "./dist",
    entryNames: "static/[name]",
    plugins: [
        copy({
            resolveFrom: "cwd",
            assets: {
                from: "./public/**/*",
                to: "./dist",
            },
            watch: true,
        }),
    ],
    define: {
        // react-domのインポート元の決定
        "process.env.NODE_ENV": `"${values.dev ? "development" : "production"}"`,
    },
    sourcemap: values.dev,
    logLevel: "info",
} satisfies esbuild.BuildOptions

if (await fs.exists(buildOptions.outdir)) {
    console.log(`Clearing ${buildOptions.outdir}...`)
    const buildOutputGlob = new Bun.Glob(path.normalize(`${buildOptions.outdir}/**`))
    for await (const buildOutput of buildOutputGlob.scan(import.meta.dirname)) {
        await fs.rm(buildOutput, { force: true })
    }
}
if (values.watch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
} else {
    await esbuild.build(buildOptions)
}
