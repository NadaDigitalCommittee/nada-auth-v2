import { renderToString } from "react-dom/server"

import * as ProfileFormCore from "./core"

export const ProfileForm = () => (
    <>
        <div
            id={ProfileFormCore.id}
            dangerouslySetInnerHTML={{
                __html: renderToString(<ProfileFormCore.Core />),
            }}
        ></div>
        <script type="module" src={`/static/${ProfileFormCore.name}.js`} />
    </>
)
