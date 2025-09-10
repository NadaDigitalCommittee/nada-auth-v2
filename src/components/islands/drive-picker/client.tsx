import { hydrateRoot } from "react-dom/client"

import * as DrivePickerCore from "./core"

/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment */
const container = document.getElementById(DrivePickerCore.id)!
const props = JSON.parse(document.getElementById(DrivePickerCore.propsId)!.textContent)
hydrateRoot(container, <DrivePickerCore.Core {...props} />)
