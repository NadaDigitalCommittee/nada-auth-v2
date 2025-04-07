import CheckIcon from "@mui/icons-material/Check"
import FolderSharedOutlinedIcon from "@mui/icons-material/FolderSharedOutlined"
import UploadIcon from "@mui/icons-material/Upload"
import { Box, Button, Link, Stack, Tooltip, Typography, css } from "@mui/material"
import { useState } from "react"

import { ErrorAlert } from "@/components/ErrorAlert"
import { NotchedOutline } from "@/components/NotchedOutline"
import { Unselectable } from "@/components/Unselectable"
import { forwardConditional } from "@/components/forwardConditional"
import { useLoadScript } from "@/hooks/useLoadScript"

/**
 * @package
 */
export const name = "drive-picker"

/**
 * @package
 */
export const id = `${name}_container`

/**
 * @package
 */
export const propsId = `${name}_props`

interface Credentials {
    accessToken: string | undefined
    apiKey: string
    appId: string
}

/**
 * @package
 */
export const Core = ({ formAction, ...credentials }: { formAction: string } & Credentials) => {
    const credentialsError = !credentials.accessToken && "資格情報が不足しています。"

    const [gapiLoaded, setGapiLoaded] = useState(false)
    const gapiLoading = !gapiLoaded && "Google APIを読み込み中..."

    useLoadScript({
        src: "https://apis.google.com/js/api.js",
        async: true,
        defer: true,
        onload: () => {
            gapi.load("picker", () => {
                setGapiLoaded(true)
            })
        },
    })

    const createPicker = () => {
        if (!gapiLoaded) throw new Error("Google API is not loaded yet")
        if (!credentials.accessToken) throw new Error("Missing Credentials: accessToken")
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setEnableDrives(true)
            .setSelectFolderEnabled(true)
            .setMode(google.picker.DocsViewMode.LIST)

        const picker = new google.picker.PickerBuilder()
            .setDeveloperKey(credentials.apiKey)
            .setOAuthToken(credentials.accessToken)
            .setAppId(credentials.appId)
            .addView(view)
            .setCallback(pickerCallback)
            .build()
        picker.setVisible(true)
    }

    const [pickedDocs, setPickedDocs] = useState<google.picker.DocumentObject[]>([])
    const pickerCallback = (data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) setPickedDocs(data.docs ?? [])
    }
    const [pickedFolder] = pickedDocs
    const [isSubmitting, setIsSubmitting] = useState(false)
    return (
        <Stack
            direction="column"
            component="form"
            action={formAction}
            onSubmit={() => {
                setIsSubmitting(true)
            }}
            method="POST"
            name={name}
            noValidate
            spacing={2}
            css={css`
                align-items: center;
            `}
        >
            {forwardConditional({
                component: ErrorAlert,
                children: credentialsError,
            })}
            <Tooltip
                describeChild
                enterTouchDelay={0}
                leaveTouchDelay={2000}
                title={forwardConditional({
                    component: Unselectable,
                    children: gapiLoading || credentialsError,
                })}
            >
                <Box
                    css={css`
                        width: fit-content;
                    `}
                >
                    <Button
                        variant="outlined"
                        css={css`
                            width: fit-content;
                        `}
                        loading={!!gapiLoading}
                        loadingPosition="start"
                        disabled={!!credentialsError}
                        startIcon={<UploadIcon />}
                        onClick={createPicker}
                        type="button"
                    >
                        ピッカーを開く
                    </Button>
                </Box>
            </Tooltip>
            {pickedFolder && (
                <>
                    <NotchedOutline label="選択されたフォルダ">
                        <Link
                            href={pickedFolder.url}
                            underline="hover"
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {pickedFolder.name}
                        </Link>
                        {!!pickedFolder.organizationDisplayName && (
                            <Tooltip
                                describeChild
                                enterTouchDelay={0}
                                leaveTouchDelay={2000}
                                title={<Unselectable>組織の共有ドライブ</Unselectable>}
                            >
                                <Typography
                                    variant="caption"
                                    css={css`
                                        line-height: unset;
                                        display: flex;
                                        flex-direction: row;
                                        gap: 0.3em;
                                    `}
                                >
                                    <FolderSharedOutlinedIcon
                                        css={css`
                                            width: 0.75em;
                                            height: 0.75em;
                                        `}
                                    />
                                    {pickedFolder.organizationDisplayName}
                                </Typography>
                            </Tooltip>
                        )}
                    </NotchedOutline>
                    <input type="hidden" value={pickedFolder.id} name="folderId" />
                    <Button
                        variant="outlined"
                        startIcon={<CheckIcon />}
                        type="submit"
                        size="large"
                        loading={isSubmitting}
                        loadingPosition="start"
                    >
                        決定
                    </Button>
                </>
            )}
        </Stack>
    )
}
