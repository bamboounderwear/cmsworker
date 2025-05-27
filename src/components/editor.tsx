import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import clsx from 'clsx'
import { Model } from './app'
import { client } from './app'
import { LeftArrow, ServerIcon, DocumentCheckIcon, TrashIcon, FileIcon, DuplicateIcon, LinkIcon } from './icons'
import EditorFields from './editor-fields'
import { vars as environment } from '../../wrangler.json'

const DEMO = environment.DEMO

export type PropertySchema = ObjectSchema | StringSchema | NumberSchema | BooleanSchema | ArraySchema

export type ReferenceSchema = {
    $ref: string
}

export type ObjectSchema = {
    type: 'object'
    title?: string
    description?: string
    properties: Record<string, ReferenceSchema | PropertySchema>
    default?: any
    heading?: string
}

export type StringSchema = {
    type: 'string'
    title?: string
    description?: string
    format?: 'date-time' | 'markdown' | `uri${string}`
    enum?: string[]
    default?: string
    heading?: string
}

export type NumberSchema = {
    type: 'number'
    title?: string
    description?: string
    default?: number
    heading?: string
}

export type BooleanSchema = {
    type: 'boolean'
    title?: string
    description?: string
    default?: boolean
    heading?: string
}

export type ArrayItemSchema =
    | ReferenceSchema
    | {
          type: 'object'
          title: string
          description?: string
          properties: Record<string, PropertySchema>
          default?: any
      }

export type ArraySchema = {
    type: 'array'
    title?: string
    description?: string
    items: ArrayItemSchema | { anyOf: ArrayItemSchema[] }
    default?: any[]
    heading?: string
}

const beforeUnload = e => {
    e.preventDefault()
}

export default function Editor({
    model,
    setModel,
    name,
    setName,
    models,
}: {
    model: string
    setModel: (value: string) => void
    name: string
    setName: (value: string | undefined) => void
    models: Model[]
}) {
    const [loading, setLoading] = useState(false)
    const [document, setDocument] = useState<any>({})
    const [documentUpdated, setDocumentUpdated] = useState(false)
    useEffect(() => {
        if (documentUpdated) window.addEventListener('beforeunload', beforeUnload)
        else window.removeEventListener('beforeunload', beforeUnload)
    }, [documentUpdated])

    const [newName, setNewName] = useState<string | undefined>(name)
    const [path, setPath] = useState<string[]>([])

    const documentModel = useMemo(() => models.find(({ name }) => name === model), [models, model])
    const singleDocument = useMemo(() => documentModel?.allowList === false, [documentModel])
    const singularCapitalName = useMemo(() => {
        if (!documentModel?.singularName) return ''
        return `${documentModel.singularName.slice(0, 1).toUpperCase()}${documentModel.singularName.slice(1)}`
    }, [documentModel])

    const goBack = useCallback(() => {
        if (path.length) {
            const last = path.pop()
            if (!isNaN(Number(last))) path.pop()
            setPath([...path])
            return
        }

        const leave = () => {
            setName(undefined)
            if (singleDocument) setModel(models[0]?.name ?? '')
        }
        if (!documentUpdated) return leave()
        if (window.confirm('Discard changes?')) leave()
    }, [path, setPath, documentUpdated, setName, singleDocument])
    useEffect(() => {
        window.cms.goBack = goBack
    }, [goBack])

    const fetchDocument = useCallback(async () => {
        if (!name || documentModel?.allowGet === false) return
        setLoading(true)
        let value
        try {
            value = (await client.getDocument(model, name)) ?? singleDocument ? {} : undefined
            if (!singleDocument && !value) return goBack()
            if (documentModel?.afterGet) value = await documentModel.afterGet(value)
            setDocument(value)
        } catch (e) {
            if (singleDocument) {
                if (documentModel?.afterGet) value = await documentModel.afterGet(value)
                setDocument({})
            } else {
                console.error(e)
                setName(undefined)
                goBack()
            }
        }
        setDocumentUpdated(false)
        setLoading(false)
    }, [setLoading, setDocument, setName, name, model, documentModel, goBack])
    useEffect(() => {
        fetchDocument()
        // @ts-ignore
        if (name === '') window.document.getElementById('document-name')?.focus()
    }, [])
    const saveDocument = useCallback(async () => {
        if (!newName) return alert(`${documentModel?.singularName} ${documentModel?.nameAlias ?? 'name'} is required.`)
        setLoading(true)
        try {
            if (name !== newName && (await client.documentExists(model, newName))) {
                if (documentModel?.allowUpdate === false) {
                    alert(`${singularCapitalName} already exists, cancelling.`)
                    return setLoading(false)
                }
                if (!confirm(`${singularCapitalName} already exists, overwrite?`)) return setLoading(false)
            }

            let value =
                document instanceof File
                    ? document
                    : {
                          ...document,
                          _modified_at: undefined,
                          _model: model,
                          _name: newName,
                      }

            if (documentModel?.beforePut) value = await documentModel.beforePut(value)

            await client.upsertDocument({
                model,
                name: name || newName,
                newName,
                value,
            })

            setDocumentUpdated(false)
            setName(newName)
        } catch (e) {
            alert(`Failed to save ${documentModel?.singularName}.`)
            console.error(e)
        }
        setLoading(false)
    }, [document, setDocumentUpdated, setLoading, name, setName, newName, documentModel])
    const deleteDocument = useCallback(async () => {
        if (!window.confirm(`Delete ${documentModel?.singularName}?`)) return
        setLoading(true)
        try {
            await client.deleteDocument(model, name)
            if (document._files) {
                for (const file of document._files) await client.deleteFile(file)
            }
            setName(undefined)
        } catch (e) {
            alert(`Failed to delete ${documentModel?.singularName}.`)
            console.error(e)
        }
        setLoading(false)
    }, [model, name, document, setLoading, documentModel])

    const [previewing, setPreviewing] = useState(false)
    const previewFrame = useRef(null)

    const previewUpdate = useDebouncedCallback(
        useCallback(() => {
            if (previewFrame.current)
                // @ts-ignore
                previewFrame.current.contentWindow.postMessage({
                    ...document,
                    _modified_at: Math.floor(Date.now() / 1000),
                    _model: model,
                    _name: newName,
                })
        }, [previewFrame, model, newName, document]),
        250
    )
    useEffect(previewUpdate, [newName, previewFrame, previewing, document])

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-[max-content,auto] min-h-full max-w-[100vw]">
            {!previewing && <div></div>}
            <div
                className={clsx('p-4 flex justify-center', previewing && 'max-w-md border-b lg:border-b-0 lg:border-r border-neutral-300')}
            >
                <div className={clsx('w-full flex flex-col gap-4 transition-[padding]', !previewing && 'lg:px-[15%] 2xl:px-[25%]')}>
                    <div className={clsx('grid gap-4', !previewing && 'md:grid-cols-[auto,max-content]')}>
                        <div className="flex gap-2">
                            <button
                                className="h-9"
                                id="document-back"
                                title={path.length ? 'Back [escape]' : `Back to ${model} [escape]`}
                                onClick={() => {
                                    if (path.length) {
                                        const last = path.pop()
                                        if (!isNaN(Number(last))) path.pop()
                                        setPath([...path])
                                        return
                                    }
                                    goBack()
                                }}
                            >
                                <LeftArrow />
                            </button>
                            <h1 className="pl-2 text-xl font-semibold flex items-center gap-2">
                                {documentModel?.singularName}
                                {documentUpdated && <span className="text-neutral-400 text-xs font-normal">unsaved changes</span>}
                                <span
                                    className={clsx(
                                        'opacity-0 transition-opacity text-neutral-400 text-xs font-medium select-none',
                                        loading && 'opacity-100'
                                    )}
                                >
                                    loading...
                                </span>
                            </h1>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                            {!singleDocument && documentModel?.allowCreate !== false && name && (
                                <button
                                    onClick={() => {
                                        setName('')
                                        setDocumentUpdated(true)
                                    }}
                                    className="action-button"
                                    title={`Duplicate ${documentModel?.singularName}`}
                                >
                                    <span>duplicate</span>
                                    <DuplicateIcon />
                                </button>
                            )}
                            {!singleDocument && documentModel?.allowDelete !== false && name && (
                                <button
                                    disabled={DEMO}
                                    onClick={deleteDocument}
                                    className="action-button"
                                    title={`Delete ${documentModel?.singularName}`}
                                >
                                    <span>delete</span>
                                    <TrashIcon />
                                </button>
                            )}
                            {((name && documentModel?.allowUpdate !== false) || (!name && documentModel?.allowCreate !== false)) &&
                                documentUpdated && (
                                    <button
                                        id="save-document"
                                        disabled={loading || DEMO}
                                        onClick={saveDocument}
                                        className="primary action-button"
                                        title={`Save ${documentModel?.singularName}`}
                                    >
                                        <span>save</span>
                                        <ServerIcon />
                                    </button>
                                )}
                            {documentModel?.previewURL && (
                                <button
                                    onClick={() => {
                                        setPreviewing(!previewing)
                                    }}
                                    className="action-button"
                                    title={`Preview ${documentModel?.singularName}`}
                                >
                                    <span>{previewing && 'end'} preview</span>
                                    {previewing && <LeftArrow />}
                                    {!previewing && <DocumentCheckIcon />}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-4 items-start">
                        {!singleDocument && (
                            <label
                                htmlFor="document-name"
                                className={clsx('flex flex-col gap-2 cursor-pointer w-full', !previewing && 'md:w-[calc(50%-0.5rem)]')}
                            >
                                <span className="flex gap-2 items-center ml-2">
                                    <span className="text-neutral-400">
                                        <FileIcon />
                                    </span>
                                    <span className="text-sm font-medium">{documentModel?.nameAlias ?? 'name'}</span>
                                    {name && name !== newName && <span className="text-xs text-neutral-400 font-normal">changed</span>}
                                </span>
                                <input
                                    id="document-name"
                                    value={newName}
                                    onChange={e => {
                                        if (e.target.value !== newName) {
                                            setNewName(e.target.value)
                                            setDocumentUpdated(true)
                                            previewUpdate()
                                        }
                                    }}
                                    placeholder={`new ${documentModel?.singularName} ${documentModel?.nameAlias ?? 'name'}`}
                                    required
                                    title={`${singularCapitalName} ${documentModel?.nameAlias ?? 'name'}`}
                                    disabled={Boolean(name) && documentModel?.allowRename === false}
                                />
                            </label>
                        )}
                    </div>

                    {Boolean(path.length) && (
                        <div className="flex gap-2 items-center">
                            <button
                                title="Back"
                                className="mr-2"
                                onClick={() => {
                                    const last = path.pop()
                                    if (!isNaN(Number(last))) path.pop()
                                    setPath([...path])
                                    return
                                }}
                            >
                                <LeftArrow />
                            </button>
                            {path.map((piece, i) => (
                                <>
                                    <span className="text-xs font-medium text-neutral-500">
                                        {isNaN(Number(piece)) ? piece : Number(piece) + 1}
                                    </span>
                                    {i !== path.length - 1 && <span className="text-xs font-medium text-neutral-300">/</span>}
                                </>
                            ))}
                        </div>
                    )}
                    {documentModel &&
                        (documentModel.customEditor ? (
                            <documentModel.customEditor
                                {...{
                                    model,
                                    name,
                                    setName,
                                    newName,
                                    setNewName,
                                    path,
                                    setPath,
                                    document,
                                    setDocument,
                                    documentUpdated,
                                    setDocumentUpdated,
                                    documentModel,
                                    previewing,
                                    loading,
                                }}
                            />
                        ) : (
                            <EditorFields
                                {...{
                                    model,
                                    name,
                                    setName,
                                    newName,
                                    setNewName,
                                    path,
                                    setPath,
                                    document,
                                    setDocument,
                                    documentUpdated,
                                    setDocumentUpdated,
                                    documentModel,
                                    previewing,
                                    loading,
                                }}
                            />
                        ))}
                </div>
            </div>
            {previewing && documentModel?.previewURL && (
                <iframe className="w-full h-full" ref={previewFrame} src={documentModel.previewURL(document)}></iframe>
            )}
        </div>
    )
}
