import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Login from './login'
import Documents from './documents'
import Editor, { ObjectSchema } from './editor'
import Header from './header'
import { EditorFieldsProps } from './editor-fields'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class Client {
    base: string
    headers: Record<string, string>
    email?: string
    unauthorized?: () => void
    onUpsert: Record<string, (name, value) => void>

    constructor({ base, token }: { base?: string; token?: string } = {}) {
        if (base) this.base = base
        else {
            const url = new URL(window.location.href)
            url.pathname = ''
            url.search = ''
            this.base = url.toString()
        }
        this.headers = {
            accept: 'application/json',
        }
        if (token) this.headers.authorization = `Bearer ${token}`
        this.onUpsert = {}
    }

    async sendVerification(email: string) {
        const request = await fetch(`${this.base}verification`, {
            method: 'post',
            headers: {
                'content-type': 'application/json',
                ...this.headers,
            },
            body: JSON.stringify({
                email,
            }),
        })
        if (request.ok) return true
        else return false
    }

    async createSession(email: string, verification: string) {
        const request = await fetch(`${this.base}api/session`, {
            method: 'post',
            headers: {
                'content-type': 'application/json',
                ...this.headers,
            },
            body: JSON.stringify({
                email,
                verification,
            }),
        })
        if (request.ok) {
            this.email = email
            return true
        }
        return false
    }

    async getSession() {
        const request = await fetch(`${this.base}api/session`, { headers: this.headers })
        if (request.ok) {
            const { email } = (await request.json()) as { email: string }
            this.email = email
            return true
        }
        return false
    }

    async deleteSession() {
        const request = await fetch(`${this.base}api/session`, { method: 'delete', headers: this.headers })
        if (request.ok) {
            this.email = undefined
            return true
        }
        return false
    }

    async listDocuments(model: string, { search, limit, after }: { search?: string; limit?: number; after?: string }) {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (limit) params.append('limit', limit.toString())
        if (after) params.append('after', after)

        const request = await fetch(`${this.base}api/${model}${params.size ? `?${params.toString()}` : ''}`, {
            headers: this.headers,
        })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('List documents failed.')
        }

        const results = (await request.json()) as {
            name: string
            modified_at: number
        } & any[]
        return { results, last: request.headers.get('x-last') }
    }

    async getDocument(model: string, name: string) {
        const request = await fetch(`${this.base}api/${model}/${name}`, { headers: this.headers })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Get document failed.')
        }
        return request.json() as Promise<Record<string, any>>
    }

    async documentExists(model: string, name: string) {
        const request = await fetch(`${this.base}api/${model}/${name}`, { method: 'head', headers: this.headers })
        if (!request.ok) {
            if (request.status === 404) return false
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Document exists failed.')
        }
        return true
    }

    async upsertDocument({ model, name, value, newName }: { model: string; name: string; value: any; newName?: string }) {
        const params = new URLSearchParams()
        if (name && newName && name !== newName) params.append('rename', newName)

        const request = await fetch(`${this.base}api/${model}/${name}${params.size ? `?${params.toString()}` : ''}`, {
            method: 'put',
            headers: { 'content-type': 'application/json', ...this.headers },
            body: JSON.stringify(value),
        })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Upsert document failed.')
        }
        if (this.onUpsert[model]) this.onUpsert[model](name, value)
    }

    async deleteDocument(model: string, name: string) {
        const request = await fetch(`${this.base}api/${model}/${name}`, {
            method: 'delete',
            headers: this.headers,
        })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Delete document failed.')
        }
    }

    async fileExists(name: string) {
        const request = await fetch(`${this.base}/files/${name}`, { method: 'head', headers: this.headers })
        if (!request.ok) {
            if (request.status === 404) return false
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('File exists failed.')
        }
        return true
    }

    async upsertFile(name: string, file: File) {
        const request = await fetch(`${this.base}api/files/${name}`, {
            method: 'put',
            headers: { 'content-type': file.type || 'application/octet-stream', ...this.headers },
            body: file,
        })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Upsert file failed.')
        }
    }

    async deleteFile(name: string) {
        const request = await fetch(`${this.base}api/files/${name}`, {
            method: 'delete',
            headers: this.headers,
        })
        if (!request.ok) {
            if (request.status === 401 && this.unauthorized) this.unauthorized()
            throw new Error('Delete file failed.')
        }
    }
}

export const client = new Client()

export type Model = {
    /** Plural, lowercase name of model (example: 'products') */
    name: string
    /** Singular, lowercase name of model (example: 'product') */
    singularName: string
    /** Optional heading annotation shown above model navigation */
    heading?: string
    /** Optional model icon shown in navigation menu */
    icon?: React.JSX.Element
    /** JSON schema OR schema generator function */
    schema?: ObjectSchema | ((value: any) => ObjectSchema)
    /** Generate preview page URL for the document to be loaded in iframe. */
    previewURL?: (document: { model: string; name: string; value: any }) => string | undefined
    /** Optionally override editor fields */
    customEditor?: React.FC<EditorFieldsProps>
    /** JSON Schema $ref definitions for creating circular schema. */
    schemaReferences?: Record<string, ObjectSchema>
    /** Set as false to enable single document mode */
    allowList?: boolean
    /** Set as false to disable document retreival (for models like users & files) */
    allowGet?: boolean
    /** Set as false to disable document creation */
    allowCreate?: boolean
    /** Set as false to disable document updates */
    allowUpdate?: boolean
    /** Set as false to disable document renaming */
    allowRename?: boolean
    /** Set as false to disable document deletion */
    allowDelete?: boolean
    /** Optional alias for the 'name' identifier */
    nameAlias?: string
    /** Optional handler for transforming document after retrieval */
    afterGet?: (value: any) => Promise<any>
    /** Optional handler for transforming document before update */
    beforePut?: (value: any) => Promise<any>
}

const initialQueries = Object.fromEntries(new URLSearchParams(window.location.search).entries())
const path = window.location.pathname.slice(1).split('/')
const initialModel = path.shift() || undefined
const initialName = path.join('/') || undefined

declare global {
    interface Window {
        cms: { name: string | undefined; model: string; goBack?: () => void }
    }
}

export default function App({ models }: { models: Model[] }) {
    const [authenticated, setAuthenticated] = useState<boolean | undefined>(undefined)
    const [model, setModel] = useState<string>(initialModel ?? models[0]?.name ?? '')
    const currentModel = useMemo(() => models.find(({ name }) => name === model), [model, models])
    const [name, setName] = useState<string | undefined>(initialName)
    const [search, setSearch] = useState<string | undefined>(initialQueries?.search)

    useEffect(() => {
        const params = new URLSearchParams()
        if (search) params.append('search', search)

        window.cms = { name, model }
        let route

        if (currentModel?.allowList === false) route = `/${model}${params.size ? `?${params.toString()}` : ''}`
        else route = `/${model}${name ? `/${name}` : ''}${params.size ? `?${params.toString()}` : ''}`

        window.history.pushState({ model, name, search }, '', route)
    }, [model, name, search, models])

    useEffect(() => {
        client.getSession().then(value => {
            setAuthenticated(value)
            client.unauthorized = () => {
                setAuthenticated(false)
            }
        })

        const updateNavigation = (e: PopStateEvent) => {
            setModel(e.state?.model)
            setName(e.state?.name)
            setSearch(e.state?.search)
        }
        window.addEventListener('popstate', updateNavigation)
        const keyboardShortcuts = (e: KeyboardEvent) => {
            // Within editor view
            if (window.cms.name !== undefined) {
                if (e.key === 'Escape') {
                    e.stopPropagation()
                    e.preventDefault()
                    document.getElementById('document-back')?.click()
                    return
                } else if (e.metaKey) {
                    switch (e.key) {
                        case 'Enter':
                            e.stopPropagation()
                            e.preventDefault()
                            document.getElementById('save-document')?.click()
                            return
                    }
                }
            }
            // Within list view
            else {
                if (e.key === 'Escape') {
                    e.stopPropagation()
                    e.preventDefault()
                    document.getElementById('clear')?.click()
                    return
                } else if (e.metaKey) {
                    switch (e.key) {
                        case 'k':
                            e.stopPropagation()
                            e.preventDefault()
                            // @ts-ignore
                            document.getElementById('search')?.select()
                            return
                        case 'Enter':
                            e.stopPropagation()
                            e.preventDefault()
                            document.getElementById('new-document')?.click()
                            return
                    }
                }
            }
        }
        window.addEventListener('keydown', keyboardShortcuts)

        return () => {
            window.removeEventListener('popstate', updateNavigation)
            window.removeEventListener('keydown', keyboardShortcuts)
        }
    }, [])

    return (
        <>
            {authenticated === false && <Login {...{ setAuthenticated }} />}
            {authenticated && (
                <div className="h-full min-h-screen grid grid-rows-[max-content,auto]">
                    <Header {...{ setAuthenticated }} />
                    {name === undefined ? (
                        <Documents {...{ model, setModel, setName, models, search, setSearch }} />
                    ) : (
                        <Editor {...{ model, setModel, name, setName, models }} />
                    )}
                </div>
            )}
        </>
    )
}
