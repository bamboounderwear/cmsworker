import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { client, Model } from './app'
import clsx from 'clsx'
import { PlusIcon, RightArrow, CloseIcon, RefreshIcon } from './icons'
import { noCase } from 'change-case'

export default function Documents({
    models,
    model,
    setModel,
    setName,
    search,
    setSearch,
}: {
    models: Model[]
    model: string
    setModel: (value: string) => void
    setName: (value: string) => void
    search: string | undefined
    setSearch: (value: string | undefined) => void
}) {
    const [loading, setLoading] = useState(true)
    const [documents, setDocuments] = useState<{ name: string; modified_at: number }[]>([])

    const currentModel = useMemo(() => models.find(({ name }) => name === model), [models, model])

    const [last, setLast] = useState<string | null>(null)
    const fetchDocuments = useCallback(
        async (next = false) => {
            setLoading(true)
            const after = next ? last || undefined : undefined
            if (!next) {
                setLoading(true)
                setDocuments([])
            }
            await client
                .listDocuments(model, { search: search || undefined, after })
                .then(({ results, last }) => {
                    if (next) setDocuments([...documents, ...results])
                    else setDocuments(results)
                    setLast(last)
                })
                .catch(() => {
                    setDocuments([])
                    alert('Failed to load results.')
                })
            setLoading(false)
        },
        [setLoading, setDocuments, model, search, last, setLast]
    )

    useEffect(() => {
        if (currentModel?.allowList === false) setName(model)
        else fetchDocuments()
    }, [model, search])

    const [searchValue, setSearchValue] = useState<string>(search ?? '')

    return (
        <div className="flex flex-col md:grid md:grid-cols-[max-content,auto] max-w-[100vw]">
            <div className="p-4">
                <div className="grid gap-2 lg:min-w-48">
                    {models.map(({ name, heading, icon, allowList }) => {
                        const selected = model == name
                        return (
                            <>
                                {heading && <h1 className="p-2 ml-2 mt-4 font-normal text-xs text-neutral-400 select-none">{heading}</h1>}
                                <button
                                    key={name}
                                    className={clsx(
                                        'group font-semibold border-0 text-neutral-500 hover:text-black dark:hover:text-white dark:bg-transparent',
                                        selected && 'bg-blue-100 dark:!bg-neutral-600 hover:bg-blue-200 !text-black dark:!text-blue-400'
                                    )}
                                    onClick={() => {
                                        setSearch('')
                                        if (selected) fetchDocuments()
                                        else {
                                            setModel(name)
                                            if (allowList === false) setName(name)
                                        }
                                    }}
                                    title={`View ${name}`}
                                >
                                    <span className={clsx('!size-3', selected && 'group-hover:hidden')}>{icon && icon}</span>
                                    <span className={clsx('hidden', selected && 'group-hover:flex')}>
                                        <RefreshIcon />
                                    </span>
                                    <span>{name}</span>
                                </button>
                                {/* TODO: Refactor to use model navigation links {currentModel?.allowFolders !== false && selected && !!folders.length && (
                                    <div className="pl-4 overflow-y-auto max-h-80">
                                        {folders.map(folderName => {
                                            const selected = folderName === folder
                                            return (
                                                <button
                                                    className={clsx(
                                                        'w-full border-none text-xs font-normal text-neutral-500 hover:text-black dark:hover:text-white dark:bg-transparent',
                                                        selected && '!text-black dark:!text-blue-400 !bg-neutral-200 dark:!bg-neutral-600'
                                                    )}
                                                    title={`Filter ${currentModel?.singularName} ${
                                                        currentModel?.folderAlias ?? 'folder'
                                                    } by '${folderName}'`}
                                                    onClick={() => {
                                                        if (selected) fetchDocuments()
                                                        else setFolder(folderName)
                                                    }}
                                                >
                                                    {folderName}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )} */}
                            </>
                        )
                    })}
                </div>
            </div>
            <div className="flex justify-center p-4 max-h-screen overflow-y-auto">
                <div className={clsx('w-full transition-[margin] h-max flex flex-col gap-4 lg:mx-[10%] 2xl:mx-[25%]')}>
                    <div className="grid md:grid-cols-[max-content,auto] gap-4 items-center">
                        <h1 className="pl-2 text-xl font-semibold flex items-center gap-2">
                            <span>{model}</span>
                            <span
                                className={clsx(
                                    `opacity-0 transition-opacity text-neutral-400 text-xs font-medium select-none`,
                                    loading && 'opacity-100'
                                )}
                            >
                                loading...
                            </span>
                        </h1>
                        <div className="flex flex-wrap gap-2 md:justify-end items-center">
                            {search && (
                                <button
                                    onClick={() => {
                                        setSearchValue('')
                                        setSearch('')
                                    }}
                                    className="px-4 font-normal text-xs bg-neutral-800 hover:bg-neutral-700 text-white"
                                    id="clear"
                                    title={`Clear ${model} filter [escape]`}
                                >
                                    <CloseIcon />
                                    clear
                                </button>
                            )}
                            <input
                                id="search"
                                className="text-xs w-full md:max-w-64 px-3"
                                placeholder="search"
                                value={searchValue}
                                onChange={e => {
                                    setSearchValue(e.target.value)
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') setSearch(searchValue)
                                }}
                                onClick={e => {
                                    // @ts-ignore
                                    e.target.select()
                                }}
                                title={`Search ${model} by ${currentModel?.nameAlias ?? 'name'}`}
                            />
                            {currentModel?.allowCreate !== false && (
                                <button
                                    className="text-xs group primary"
                                    id="new-document"
                                    onClick={() => setName('')}
                                    title={`Create new ${currentModel?.singularName}`}
                                >
                                    <PlusIcon />
                                    <span>new</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {!loading && documents.length === 0 && <div className="text-sm pl-2 text-neutral-500">no results</div>}

                    {!loading && documents.length > 0 && (
                        <div className="overflow-auto">
                            <table className="documents">
                                <colgroup>
                                    <col />
                                    {Object.keys(documents[0]).map(key => (
                                        <col key={key} />
                                    ))}
                                    <col />
                                </colgroup>

                                <thead>
                                    <tr>
                                        <th></th>
                                        {Object.keys(documents[0]).map(key => (
                                            <th key={key}>
                                                {key === 'name' && currentModel?.nameAlias ? currentModel?.nameAlias : noCase(key)}
                                            </th>
                                        ))}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {documents.map((document, i) => (
                                        <tr
                                            key={document.name}
                                            onClick={() => {
                                                setName(document.name)
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <td tabIndex={i + 1} role="button" title={`Open ${document.name}`}>
                                                <div className="flex">
                                                    <RightArrow />
                                                </div>
                                            </td>
                                            {Object.keys(documents[0]).map(key => (
                                                <td>{document[key]}</td>
                                            ))}
                                            <td role="button" title={`Open ${document.name}`}></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {last && (
                        <div className="flex justify-center">
                            <button onClick={() => fetchDocuments(true)}>load more</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
