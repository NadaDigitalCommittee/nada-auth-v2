import { type ElementType, type ReactNode, createElement } from "react"

const isIgnored = (node: ReactNode) => typeof node === "boolean" || node == null

export const forwardConditional = <P extends { children: ReactNode }>({
    component,
    ...props
}: {
    component: ElementType<Omit<P, "component">>
} & P) => (isIgnored(props.children) ? props.children : createElement(component, props))
