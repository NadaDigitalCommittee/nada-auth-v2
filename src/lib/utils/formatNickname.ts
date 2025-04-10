import * as v from "valibot"

import { type NadaAcWorkSpaceUser, NadaAcWorkSpaceUserType } from "@/lib/types/nadaAc"
import { Warning } from "@/lib/utils/exceptions"

export enum FormatSpecifier {
    CombinedGrade = "G",
    Class = "c",
    Number = "n",
    Cohort = "C",
    FirstName = "F",
    LastName = "L",
    PercentSignEscape = "%",
}

export class UnknownFormatSpecifierWarning extends Warning {
    constructor(specifier: string) {
        super(`Unknown format specifier '%${specifier}'`)
    }
}

export class UnavailableFormatSpecifierWarning extends Warning {
    constructor(specifier: string) {
        super(`The format specifier '%${specifier}' is not available for this type of user`)
    }
}

export class UnexpectedEndOfInputWarning extends Warning {
    constructor() {
        super(`Unexpected end of input`)
    }
}

interface NicknameFormatResult {
    formatted: string
    warnings: Warning[]
}

export const formatNickname = (
    template: string,
    user: NadaAcWorkSpaceUser,
): NicknameFormatResult => {
    const warnings: Warning[] = []
    const formatted = template.replace(/%(.|$)/gu, (match: string) => {
        const specifier = match[1]
        if (!specifier) return warnings.push(new UnexpectedEndOfInputWarning()), ""
        const formatSpecifierParseResult = v.safeParse(v.enum(FormatSpecifier), specifier)
        if (!formatSpecifierParseResult.success)
            return warnings.push(new UnknownFormatSpecifierWarning(specifier)), ""
        const formatSpecifier = formatSpecifierParseResult.output
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (formatSpecifier) {
            case FormatSpecifier.FirstName:
                return user.profile.firstName
            case FormatSpecifier.LastName:
                return user.profile.lastName
            case FormatSpecifier.PercentSignEscape:
                return "%"
        }
        switch (user.type) {
            case NadaAcWorkSpaceUserType.Student:
                switch (formatSpecifier) {
                    case FormatSpecifier.CombinedGrade:
                        return `${user.profile.combinedGrade}`
                    case FormatSpecifier.Class:
                        return `${user.profile.class}`
                    case FormatSpecifier.Number:
                        return `${user.profile.number}`
                    case FormatSpecifier.Cohort:
                        return `${user.profile.cohort}`
                }
                break
            case NadaAcWorkSpaceUserType.Others:
                return warnings.push(new UnavailableFormatSpecifierWarning(formatSpecifier)), ""
        }
    })
    return { formatted, warnings }
}
