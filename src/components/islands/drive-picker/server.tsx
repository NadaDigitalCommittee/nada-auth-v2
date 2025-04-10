import { css } from "@mui/material"
import type { ComponentProps } from "react"
import { renderToString } from "react-dom/server"

import * as DrivePickerCore from "./core"

export const DrivePicker = (props: ComponentProps<typeof DrivePickerCore.Core>) => (
    <>
        <div
            id={DrivePickerCore.id}
            css={css`
                width: 100%;
            `}
            dangerouslySetInnerHTML={{
                __html: renderToString(<DrivePickerCore.Core {...props} />),
            }}
        ></div>
        <script id={DrivePickerCore.propsId} type="application/json">
            {JSON.stringify(props)}
        </script>
        <script type="module" src={`/static/${DrivePickerCore.name}.js`} />
    </>
)
