import { useEffect } from "react"
import type { SetRequired, WritableKeysOf } from "type-fest"

type PickWritable<T> = Pick<T, WritableKeysOf<T>>

export const useLoadScript = (
    props: SetRequired<Readonly<Partial<PickWritable<HTMLScriptElement>>>, "src">,
) => {
    useEffect(() => {
        const script = document.createElement("script")
        Object.assign(script, props)
        document.body.appendChild(script)
        return () => {
            script.remove()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- propsの変更を監視する必要がない
    }, [])
}
