import React, { useCallback, useMemo } from 'react'
import { ArraySchema, BooleanSchema, NumberSchema, ObjectSchema, PropertySchema, StringSchema } from './editor'
import clsx from 'clsx'
import { CheckboxIcon, PlusIcon, RightArrow, TrashIcon } from './icons'
import {
    MDXEditor,
    headingsPlugin,
    imagePlugin,
    linkPlugin,
    linkDialogPlugin,
    listsPlugin,
    quotePlugin,
    toolbarPlugin,
    BoldItalicUnderlineToggles,
    BlockTypeSelect,
    CreateLink,
    InsertImage,
    ListsToggle,
    UndoRedo,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { client, Model } from './app'
import { noCase } from 'change-case'
import EditorFieldURI from './editor-field-uri'
import EditorFieldArray from './editor-field-array'
import EditorFieldMarkdown from './editor-field-markdown'

function set(object: any, model: string[], value: any) {
    let current = object
    const last = model.pop() as string
    for (const piece of model) {
        if (current[piece] === undefined) {
            if (isNaN(Number(piece))) current[piece] = {}
            else current[piece] = []
        }
        current = current[piece]
    }
    current[last] = value
    return true
}

export type EditorFieldsProps = {
    model: string
    name: string | undefined
    setName: (value: string | undefined) => void
    newName: string | undefined
    setNewName: (value: string | undefined) => void
    path: string[]
    setPath: (value: string[]) => void
    document: any
    setDocument: (value: any) => void
    documentUpdated: boolean
    setDocumentUpdated: (value: boolean) => void
    documentModel: Model
    previewing: boolean
    loading: boolean
}

export default function EditorFields({
    path,
    setPath,
    document,
    setDocument,
    setDocumentUpdated,
    documentModel,
    previewing,
    loading,
}: EditorFieldsProps) {
    const { currentValue, currentSchema } = useMemo(() => {
        let currentValue
        let currentSchema: ObjectSchema | ArraySchema

        if (document && documentModel.schema) {
            currentValue = document
            currentSchema = typeof documentModel.schema === 'function' ? documentModel.schema(document) : documentModel.schema

            for (const piece of path) {
                // Lookup path property schema OR array item schema
                // @ts-ignore currentSchema is ObjectSchema
                if (isNaN(Number(piece))) currentSchema = currentSchema.properties[piece]
                else {
                    // @ts-ignore currentSchema is ArraySchema
                    if ((currentSchema as ArraySchema).items?.anyOf) {
                        const itemType = currentValue[piece]._type
                        // @ts-ignore currentSchema is ArraySchema
                        currentSchema = currentSchema.items.anyOf.find(item => {
                            const currentReference = item?.$ref as string | undefined
                            if (currentReference) {
                                if (!documentModel.schemaReferences || !documentModel.schemaReferences[currentReference]) {
                                    alert(`Missing schema reference "${currentReference}"`)
                                    throw new Error(`Missing schema reference "${currentReference}"`)
                                }
                                return documentModel.schemaReferences[currentReference].title === itemType
                            }
                            return item.title === itemType
                        })
                        // @ts-ignore currentSchema is ArraySchema
                    } else currentSchema = currentSchema.items
                }

                // @ts-ignore currentSchema might be a reference
                const currentReference = currentSchema?.$ref as string | undefined
                if (currentReference) {
                    if (!documentModel.schemaReferences || !documentModel.schemaReferences[currentReference]) {
                        alert(`Missing schema reference "${currentReference}"`)
                        throw new Error(`Missing schema reference "${currentReference}"`)
                    }
                    currentSchema = documentModel.schemaReferences[currentReference] as ObjectSchema
                }

                // Create document structure as-needed
                if (currentValue[piece] === undefined) {
                    if (currentSchema.type === 'object') {
                        currentValue[piece] = {}
                    }
                    if (currentSchema.type === 'array') {
                        currentValue[piece] = []
                    }
                }
                currentValue = currentValue[piece]
            }
        }
        // @ts-ignore
        return { currentValue, currentSchema }
    }, [path, document, documentModel])

    const addFile = useCallback(
        (file: string) => {
            setDocument({ ...document, _files: [...(document?._files ?? []), file] })
        },
        [setDocument, document]
    )
    const removeFile = useCallback(
        (file: string) => {
            const i = document?._files?.indexOf(file)
            if (i !== undefined && i !== -1) {
                document._files.splice(i, 1)
                setDocument({ ...document })
            }
        },
        [document, setDocument]
    )

    return (
        <div className={clsx('flex flex-wrap gap-4', loading && 'animate-pulse')}>
            {(currentSchema?.title || currentSchema?.description) && (
                <div className="w-full flex gap-2 ml-2 items-center">
                    {currentSchema?.title && <span className="text-sm font-medium">{currentSchema.title}</span>}
                    {currentSchema?.description && (
                        <span className="text-xs font-normal text-neutral-500">{currentSchema.description}</span>
                    )}
                </div>
            )}
            {
                /* @ts-ignore */
                Object.keys(currentSchema?.properties ?? {}).map(key => {
                    const id = `editor-field-${key}`

                    const currentObjectSchema = currentSchema as ObjectSchema
                    let keySchema: PropertySchema
                    // @ts-ignore $ref can be undefined
                    const keySchemaReference = currentObjectSchema.properties[key]?.$ref
                    if (keySchemaReference) {
                        if (!documentModel.schemaReferences || !documentModel.schemaReferences[keySchemaReference]) {
                            alert(`Missing schema reference "${keySchemaReference}"`)
                            throw new Error(`Missing schema reference "${keySchemaReference}"`)
                        }
                        keySchema = documentModel.schemaReferences[keySchemaReference]
                    } else keySchema = currentObjectSchema.properties[key] as PropertySchema

                    const keyValue = currentValue[key] ?? keySchema?.default

                    const title = keySchema?.title ?? noCase(key)

                    const update = newValue => {
                        set(document, [...path, key], newValue)
                        setDocument({ ...document })
                        setDocumentUpdated(true)
                    }

                    if (keySchema.type === 'object')
                        return (
                            <div className={clsx('w-full', !previewing && 'md:w-[calc(50%-0.5rem)]')} key={key}>
                                <button title={keySchema?.description ?? key} onClick={() => setPath([...path, key])}>
                                    <span>{title}</span>
                                    <RightArrow />
                                </button>
                            </div>
                        )

                    let fullWidth = false
                    const input = (() => {
                        if (keySchema.type === 'string') {
                            if (keySchema.format === 'date-time')
                                return (
                                    <input
                                        id={id}
                                        type="datetime-local"
                                        value={keyValue}
                                        onChange={e => update(e.target.value as string)}
                                        disabled={loading}
                                    />
                                )
                            if (keySchema.format?.startsWith('uri')) {
                                return (
                                    <EditorFieldURI
                                        {...{
                                            id,
                                            loading,
                                            value: keyValue,
                                            format: keySchema.format,
                                            update,
                                            addFile,
                                            removeFile,
                                        }}
                                    />
                                )
                            }
                            if (keySchema.format === 'markdown') {
                                if (loading) return
                                fullWidth = true
                                return <EditorFieldMarkdown {...{ value: keyValue, update, addFile }} />
                            }
                            if (keySchema.enum)
                                return (
                                    <select id={id} value={keyValue} onChange={e => update(e.target.value)} disabled={loading}>
                                        {!keySchema?.default && <option className="text-neutral-500" value=""></option>}
                                        {keySchema.enum.map(option => (
                                            <option key={option}>{option}</option>
                                        ))}
                                    </select>
                                )
                            return <input id={id} value={keyValue} onChange={e => update(e.target.value as string)} disabled={loading} />
                        }
                        if (keySchema.type === 'number')
                            return (
                                <input
                                    type="number"
                                    id={id}
                                    value={keyValue as string}
                                    onChange={e => update(Number(e.target.value))}
                                    disabled={loading}
                                />
                            )
                        if (keySchema.type === 'boolean')
                            return (
                                <label
                                    htmlFor={id}
                                    className={clsx(
                                        'cursor-pointer flex w-9 h-9 justify-center items-center border border-neutral-300 dark:border-neutral-600 rounded-md',
                                        keyValue ? 'bg-blue-100 dark:bg-neutral-700' : 'bg-white dark:bg-neutral-800'
                                    )}
                                >
                                    <span className={clsx(keyValue ? '' : 'hidden')}>
                                        <CheckboxIcon />
                                    </span>
                                    <input
                                        onChange={e => update(e.target.checked)}
                                        checked={keyValue}
                                        id={id}
                                        className="hidden"
                                        type="checkbox"
                                        disabled={loading}
                                    />
                                </label>
                            )
                        if (keySchema.type === 'array') {
                            fullWidth = true
                            return (
                                <EditorFieldArray
                                    {...{ loading, update, value: keyValue, keySchema, propertyKey: key, documentModel, path, setPath }}
                                />
                            )
                        }
                    })()

                    return (
                        <>
                            {keySchema?.heading && (
                                <h2 className="w-full font-semibold py-2 pl-2 border-b border-b-neutral-300 dark:border-b-neutral-600 my-2">
                                    {keySchema.heading}
                                </h2>
                            )}
                            <label
                                key={[...path, key].join('.')}
                                htmlFor={id}
                                className={clsx(
                                    'flex flex-col gap-2 cursor-pointer w-full',
                                    !fullWidth && !previewing && 'md:w-[calc(50%-0.5rem)]'
                                )}
                            >
                                <span className="text-sm font-medium ml-2">{title}</span>
                                {input}
                                {keySchema?.description && <span className="ml-2 text-xs text-neutral-500">{keySchema?.description}</span>}
                            </label>
                        </>
                    )
                })
            }
        </div>
    )
}
