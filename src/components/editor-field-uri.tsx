import React, { useCallback, useMemo, useState } from 'react'
import { LinkIcon, TrashIcon, UploadIcon } from './icons'
import { client } from './app'

export default function EditorFieldURI({
    id,
    value,
    format,
    update,
    addFile,
    removeFile,
    loading,
}: {
    id: string
    value: string | undefined
    format: string
    update: (value: string | undefined) => void
    addFile: (value: string) => void
    removeFile: (value: string) => void
    loading: boolean
}) {
    const isFile = useMemo(() => {
        try {
            if (value?.startsWith('/files/')) return true
            const url = new URL(value ?? '')
            if (url.host === window.location.host && url.pathname.startsWith('/files/')) return true
        } catch (e) {}
        return false
    }, [value])

    const [isLoading, setIsLoading] = useState(false)
    const deleteFile = useCallback(async () => {
        setIsLoading(true)
        try {
            if (value?.startsWith('/files/')) await client.deleteFile(value.slice('/files/'.length))
            else {
                const url = new URL(value ?? '')
                await client.deleteFile(url.pathname.slice('/files/'.length))
            }
            removeFile(value as string)
            update('')
        } catch (e) {
            alert(`Unable to delete file at ${value}`)
        }
        setIsLoading(false)
    }, [value, update, setIsLoading, removeFile])

    const uploadFile = useCallback(
        async (file: File) => {
            const previousFile = isFile ? value : undefined
            setIsLoading(true)

            const date = new Date()
            const key = `${date.getFullYear()}/${date.getMonth() + 1}/${file.name}`
            await client.upsertFile(key, file)
            const url = new URL(window.location.href)
            url.search = ''
            url.pathname = `/files/${key}`
            update(`/files/${key}`)
            addFile(key)

            setIsLoading(false)
            if (previousFile) await deleteFile()
        },
        [isFile, value, update, setIsLoading, deleteFile]
    )

    return (
        <div className="grid grid-cols-[auto,max-content] gap-2">
            <input id={id} value={value} onChange={e => update(e.target.value as string)} disabled={loading || isFile || isLoading} />
            <div className="flex gap-2">
                {value && (
                    <a className="button px-3" href={value} target="_blank" title="Open URI">
                        <LinkIcon />
                    </a>
                )}
                <label className="button px-3" title="Upload new file">
                    <input
                        className="hidden"
                        type="file"
                        accept={format.startsWith('uri-') ? `${format.slice('uri-'.length)}/*` : undefined}
                        onChange={e => {
                            if (e.target.files && e.target.files[0]) uploadFile(e.target.files[0])
                        }}
                        disabled={loading || isLoading}
                    />
                    <UploadIcon />
                </label>
                {isFile && (
                    <button className="px-3" disabled={isLoading} onClick={() => deleteFile()}>
                        <TrashIcon />
                    </button>
                )}
            </div>
        </div>
    )
}
