import pluginJs from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import importAccess from "eslint-plugin-import-access/flat-config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
    { files: ["**/*.{js,mjs,cjs,ts,tsx}"] },
    { ignores: ["eslint.config.mjs", ".wrangler/**/*", "dist/**/*"] },
    {
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    pluginJs.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
        rules: {
            "@typescript-eslint/switch-exhaustiveness-check": [
                "error",
                { considerDefaultExhaustiveForUnions: true },
            ],
            "@typescript-eslint/consistent-indexed-object-style": ["error"],
            "no-nested-ternary": ["error"],
            "no-unneeded-ternary": ["error"],
            "lines-between-class-members": ["warn"],
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                {
                    allowNumber: true,
                    allowBoolean: true,
                    allowAny: false,
                    allowNullish: false,
                    allowRegExp: true,
                    allowNever: false,
                    allowArray: false,
                },
            ],
        },
    },
    {
        plugins: {
            "import-access": importAccess,
        },
        rules: {
            "import-access/jsdoc": ["error"],
        },
    },
    eslintConfigPrettier,
)
