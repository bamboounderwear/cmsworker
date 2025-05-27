import clsx from 'clsx'
import { PlusIcon, RightArrow, TrashIcon } from './icons'
import { ArraySchema, BooleanSchema, NumberSchema, ObjectSchema, ReferenceSchema, StringSchema } from './editor'
import { Model } from './app'
import { useMemo } from 'react'

function nextID(value?: { _id: number }[]) {
    if (!value) return 1
    let current = 0
    for (const { _id } of value) if (_id > current) current = _id
    return current + 1
}

type TableEditableSchema =
    | { type: 'string'; title?: string; description?: string; default?: string }
    | {
          type: 'string'
          format?: 'date-time'
          title?: string
          description?: string
          default?: string
      }
    | { type: 'string'; enum?: string[]; title?: string; description?: string; default?: string }
    | { type: 'number'; title?: string; description?: string; default?: string }
    | { type: 'boolean'; title?: string; description?: string; default?: string }

export default function EditorFieldArray({
    propertyKey,
    update,
    keySchema,
    value,
    loading,
    path,
    setPath,
    documentModel,
}: {
    propertyKey: string
    update: (value: any) => void
    keySchema: ArraySchema
    value: any[] | undefined
    loading: boolean
    path: string[]
    setPath: (path: string[]) => void
    documentModel: Model
}) {
    const AddItemButton = props => (
        <button
            key={props.key}
            className={clsx(value?.length && 'border-b')}
            onClick={() => {
                update([
                    ...(value ?? []),
                    {
                        ...(props?.default ?? {}),
                        _id: nextID(value),
                        _type: props.title,
                    },
                ])
            }}
            disabled={loading}
        >
            <PlusIcon />
            <span>{props?.title}</span>
            <span className="text-xs font-normal text-neutral-500">{props?.description}</span>
        </button>
    )

    const columns: { key: string; schema: TableEditableSchema }[] = useMemo(() => {
        const columns: { key: string; schema: TableEditableSchema }[] = []
        const isTableEditable = (schema: any) => {
            if (schema?.type === 'string') {
                if (schema?.format === 'date-time') return true
                if (Boolean(schema?.enum)) return true
                if (!Boolean(schema?.format)) return true
            }
            if (schema.type === 'number' || schema.type === 'boolean') return true
            return false
        }

        if (keySchema.items?.properties) {
            const itemsProperties = (keySchema.items as ObjectSchema)?.properties
            Object.keys(itemsProperties).forEach(key => {
                const propertySchema = itemsProperties[key]
                if (isTableEditable(propertySchema)) columns.push({ key, schema: propertySchema as TableEditableSchema })
            })
        }

        if (keySchema.items?.anyOf) {
            for (const itemsSchema of keySchema.items.anyOf as ObjectSchema[]) {
                const itemsProperties = itemsSchema.properties
                Object.keys(itemsProperties).forEach(key => {
                    const propertySchema = itemsProperties[key] as any

                    if (
                        isTableEditable(propertySchema) &&
                        keySchema.items.anyOf.every(({ properties: otherItemsProperties }) => {
                            const otherPropertySchema = otherItemsProperties[key]
                            if (!otherPropertySchema) return false
                            return JSON.stringify(otherPropertySchema) === JSON.stringify(propertySchema)
                        })
                    )
                        columns.push({ key, schema: propertySchema as TableEditableSchema })
                })
            }
        }

        return columns
    }, [keySchema])

    return (
        <div className="flex flex-col gap-2">
            {!!value?.length && (
                <div className="w-full max-w-full overflow-auto pb-4 max-h-[50vh]">
                    <table>
                        <colgroup>
                            <col />
                            {columns.map(({ key }) => (
                                <col key={key} />
                            ))}
                            <col />
                        </colgroup>

                        <thead>
                            <tr>
                                <th></th>
                                {columns.map(({ key, schema: { title, description } }) => (
                                    <th key={key} title={description}>
                                        {title ?? key}
                                    </th>
                                ))}
                                <th></th>
                            </tr>
                        </thead>

                        <tbody>
                            {value.map((item, i) => (
                                <tr
                                    key={item._id}
                                    draggable="true"
                                    onDragStart={e => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({ propertyKey, i }))
                                        e.dataTransfer.effectAllowed = 'move'
                                    }}
                                    onDragEnter={e => {
                                        e.preventDefault()
                                    }}
                                    onDragOver={e => {
                                        e.preventDefault()
                                    }}
                                    onDrop={e => {
                                        try {
                                            const payload = JSON.parse(e.dataTransfer.getData('application/json')) as {
                                                key: string
                                                i: number
                                            }
                                            if (propertyKey !== payload.key) throw new Error('Cannot drop between keys.')
                                            if (payload.i === i) return
                                            const payloadValue = value[payload.i]
                                            value.splice(payload.i, 1)
                                            value.splice(i, 0, payloadValue)
                                            update([...value])
                                        } catch (e) {
                                            console.error(e)
                                        }
                                    }}
                                >
                                    <td className="p-0">
                                        <button
                                            title={`Open item`}
                                            className="flex justify-end rounded-none w-full h-full min-h-full border-0 bg-transparent py-3"
                                            onClick={() => {
                                                setPath([...path, propertyKey, i.toString()])
                                            }}
                                        >
                                            <RightArrow />
                                        </button>
                                    </td>
                                    {columns.map(({ key, schema }) => {
                                        let type
                                        if (schema.type === 'string') {
                                            if (schema?.enum) {
                                                return (
                                                    <td key={key} className="p-0">
                                                        <select
                                                            autoComplete="off"
                                                            className="min-w-full w-max max-w-[400px] !outline-transparent h-full rounded-none pointer-events-auto"
                                                            value={item[key] ?? schema?.default}
                                                            onChange={e => {
                                                                value[i] = { ...item, [key]: e.target.value }
                                                                update(value)
                                                            }}
                                                        >
                                                            {!schema?.default && <option className="text-neutral-500" value=""></option>}
                                                            {schema?.enum.map(value => (
                                                                <option key={value}>{value}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                )
                                            } else if (schema?.format === 'date-time') type = 'datetime-local'
                                            else type = 'text'
                                        } else if (schema.type === 'number') type = 'number'
                                        else if (schema.type === 'boolean') type = 'checkbox'

                                        return (
                                            <td key={key} className="p-0">
                                                <input
                                                    autoComplete="off"
                                                    type={type}
                                                    style={{ fieldSizing: 'content' }}
                                                    className="min-w-full max-w-[400px]  outline-blue-500 hover:!outline  border-none rounded-none pointer-events-auto"
                                                    value={item[key] ?? schema?.default}
                                                    onChange={e => {
                                                        value[i] = { ...item, [key]: e.target.value }
                                                        update(value)
                                                    }}
                                                />
                                            </td>
                                        )
                                    })}
                                    <td className="p-0 cursor-pointer">
                                        <div className="flex justify-end">
                                            <button
                                                className="h-full rounded-none border-0 bg-transparent hover:bg-red-100 dark:hover:bg-red-500 group-last:rounded-br-md py-3"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    value.splice(i, 1)
                                                    update([...value])
                                                }}
                                                title={`Delete item`}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {
                    /* @ts-ignore */
                    keySchema?.items?.anyOf &&
                        /* @ts-ignore */
                        keySchema.items.anyOf.map((item, i) => {
                            let itemSchema: ObjectSchema
                            const itemSchemaReference = item?.$ref
                            if (itemSchemaReference) {
                                if (!documentModel.schemaReferences || !documentModel.schemaReferences[itemSchemaReference]) {
                                    alert(`Missing schema reference "${itemSchemaReference}"`)
                                    throw new Error(`Missing schema reference "${itemSchemaReference}"`)
                                }

                                itemSchema = documentModel.schemaReferences[itemSchemaReference]
                            } else itemSchema = item

                            return <AddItemButton {...{ key: i, ...itemSchema }} />
                        })
                }
                {
                    /* @ts-ignore */
                    keySchema?.items?.properties && <AddItemButton {...{ key: -1, ...keySchema?.items }} />
                }
                {
                    /* @ts-ignore */
                    keySchema?.items?.$ref &&
                        documentModel.schemaReferences &&
                        /* @ts-ignore */
                        documentModel.schemaReferences[keySchema?.items?.$ref] && (
                            <AddItemButton
                                /* @ts-ignore */
                                {...{ key: -1, ...documentModel.schemaReferences[keySchema?.items?.$ref] }}
                            />
                        )
                }
            </div>
        </div>
    )
}
