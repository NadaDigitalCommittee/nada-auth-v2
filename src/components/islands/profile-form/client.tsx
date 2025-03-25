import { hydrateRoot } from "react-dom/client"

import * as ProfileFormCore from "./core"

const container = document.getElementById(ProfileFormCore.id)
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
hydrateRoot(container!, <ProfileFormCore.Core />)
