/* eslint-disable no-console */
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
        const [, patchedPackageName, patchedPackageVersion] =
            /^(.+)@([^@]+)$/.exec(patchedPackage) ?? []
        if (!patchedPackageName || !patchedPackageVersion) {
            console.write("✗ Fail\n")
            throw new Error(`Patched dependency entry "${patchedPackage}" is not a valid value.`)
        }
        const bunLockFileInstalledPackage = bunLockFileInstalledPackages[patchedPackageName]
        if (!bunLockFileInstalledPackage) {
            console.write("✗ Fail\n")
            throw new Error(
                `Patched dependency "${patchedPackageName}" is not present in bun.lock(b).`,
            )
        }
        const [installedPackage] = bunLockFileInstalledPackage
        const [, installedPackageVersion] = installedPackage.split("@")
        if (installedPackageVersion !== patchedPackageVersion) {
            console.write("✗ Fail\n")
            throw new Error(`Patched dependency "${patchedPackage}" is outdated.
            patched version:   ${patchedPackage}
            installed version: ${installedPackage}`)
        }
        console.write("✓ Pass\n")
    })
} finally {
    await Bun.$`git reset --hard HEAD && git clean -f`.quiet()
    if (hasUncommittedChanges) await Bun.$`git stash pop`.quiet()
}
