/* eslint-disable no-console */
import type { BunLockFilePackageArray } from "bun"

import packageJson from "../../package.json"

const hasUncommittedChanges = await Bun.$`git status --porcelain`.text()
if (hasUncommittedChanges) await Bun.$`git stash -u`.quiet()
await Bun.$`bun install --ignore-scripts --save-text-lockfile --frozen-lockfile --lockfile-only`.quiet()
const lockFile = await import("../../bun.lock")
const { patchedDependencies } = packageJson
const bunLockFileInstalledPackages = lockFile.packages
const patchedPackageList = Object.keys(patchedDependencies)

const createInitMessage = (s: string) => `Checking patch ${s} `
const initMessageMaxLength = Math.max(...patchedPackageList.map((s) => createInitMessage(s).length))
try {
    patchedPackageList.forEach((patchedPackage) => {
        console.write(createInitMessage(patchedPackage).padEnd(initMessageMaxLength + 3, "."))
        const [patchedPackageName, patchedPackageVersion] = patchedPackage.split("@")
        // 実際にはundefinedになりうる
        const bunLockFileInstalledPackage = bunLockFileInstalledPackages[patchedPackageName] as
            | BunLockFilePackageArray
            | undefined
        if (!bunLockFileInstalledPackage) {
            console.write("✗ Fail\n")
            throw new Error(
                `Patched dependency "${patchedPackageName}" is not present in bun.lock(b).`,
            )
        }
        const [installedPackage] = bunLockFileInstalledPackage
        // https://github.com/sindresorhus/type-fest/pull/1047
        const [, installedPackageVersion] = installedPackage.split("@") as unknown as [
            string,
            string,
        ]
        if (installedPackageVersion !== patchedPackageVersion) {
            console.write("✗ Fail\n")
            throw new Error(`Patched dependency "${patchedPackage}" is outdated.
            patched version:   ${patchedPackage}
            installed version: ${installedPackage}`)
        }
        console.write(`✓ Pass\n`)
    })
} finally {
    await Bun.$`git reset --hard HEAD && git clean -f`.quiet()
    if (hasUncommittedChanges) await Bun.$`git stash pop`.quiet()
}
