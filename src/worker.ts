import { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { Methods, Trouter } from 'trouter'
import { parse } from 'cookie'
import { usersController } from './controllers/default'
import addVerificationRoutes from './routes/verification'
import addSessionsRoutes from './routes/sessions'
import { addDocumentsRoutes } from './routes/documents'
import addFilesRoutes from './routes/files'
import { addSessionAuthentication, addTokenAuthentication } from './middleware/authentication'
import { addBCAuthentication, addBCRoutes } from './plugins/big-commerce/server'

export type Controller = {
    list?: (
        listParameters: {
            model: string
            search?: string
            limit: number
            after: any
        },
        parameters: Parameters
    ) => Promise<{ results: { name: string; modified_at?: string } & any; last?: any }>
    exists?: (existsParameters: { model: string; name: string }, parameters: Parameters) => Promise<Boolean>
    get?: (getParameters: { model: string; name: string }, parameters: Parameters) => Promise<any | Response | undefined | null>
    put?: (
        putParameters: { model: string; name: string; rename?: string; value: any; modified_by: string; move?: string },
        parameters: Parameters
    ) => Promise<void | boolean>
    delete?: (deleteParameters: { model: string; name: string }, parameters: Parameters) => Promise<void | boolean>
}

/**
 * Use controllers to override default model behavior and integrate with external APIs
 */
export const controllers: Record<string, Controller> = {
    users: usersController,
}

/**
 * Use middleware to add behavior to all incoming requests (like custom authentication or request initialization)
 */
export const middleware: ((parameters: Parameters) => void | Promise<void>)[] = []

addSessionAuthentication()
addTokenAuthentication()

type Environment = {
    DB: D1Database
    FILES: R2Bucket
    RESEND_KEY?: string
    DEMO?: boolean
    ASSETS: any
    [key: string]: any
}

export type Parameters = {
    request: Request
    environment: Environment
    url: URL
    headers: Record<string, string>
    queries: Record<string, string>
    parameters: Record<string, string>
    body?: Record<string, any> | ReadableStream | null
    user: string | false
    cache: {
        get: (key: string) => Promise<any | undefined>
        put: (key: string, value: any) => Promise<boolean>
        delete: (key: string) => Promise<boolean>
    }
    session?: string
    token?: string
    [key: string]: any
}

export const responses = {
    badRequest: (message = '') => new Response(message, { status: 400 }),
    unauthorized: new Response(undefined, { status: 401 }),
    json: (payload: any, headers?: Record<string, string | undefined>) =>
        new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', ...headers } }),
    notFound: new Response(undefined, { status: 404 }),
    success: ({ success }) => new Response(undefined, { status: Boolean(success) ? 200 : 500 }),
    noContent: new Response(undefined, { status: 204 }),
}

export const time = () => Math.floor(Date.now() / 1000)

/**
 * Use router to create routes; add from most to least specific
 */
export const router = new Trouter()

addVerificationRoutes()
addSessionsRoutes()
addFilesRoutes()
addDocumentsRoutes()

export default {
    async fetch(request: Request, environment: Environment) {
        const url = new URL(request.url)
        const headers = Object.fromEntries(request.headers.entries())

        const match = router.find(request.method as Methods, url.pathname)
        const [handler] = match.handlers
        if (handler)
            try {
                let body = request.body
                if (headers['content-type'] === 'application/json') body = await request.json()

                const session = parse(headers?.cookie ?? '')?.session
                const tokenPrefix = `Bearer `
                const token =
                    headers?.authorization && headers.authorization.startsWith(tokenPrefix)
                        ? headers.authorization.slice(tokenPrefix.length)
                        : undefined

                let parameters: Parameters = {
                    request,
                    environment,
                    url,
                    headers,
                    queries: Object.fromEntries(Array.from(url.searchParams.entries()).map(([key, value]) => [key, decodeURI(value)])),
                    parameters: match.params,
                    body,
                    cache: {
                        async get(key) {
                            const cached = await environment.DB.prepare('select value from cache where key = ?')
                                .bind(key)
                                .first<string>('value')
                            if (cached) return JSON.parse(cached)
                        },
                        async put(key, value) {
                            const existing = await environment.DB.prepare('select rowid from cache where key = ?')
                                .bind(key)
                                .first<number>('rowid')
                            if (existing)
                                return (
                                    await environment.DB.prepare('update cache set value = ? where key = ?')
                                        .bind(JSON.stringify(value), key)
                                        .run()
                                ).success
                            else
                                return (
                                    await environment.DB.prepare('insert into cache (key, value) values (?, ?)')
                                        .bind(key, JSON.stringify(value))
                                        .run()
                                ).success
                        },
                        async delete(key) {
                            return (await environment.DB.prepare('delete from cache where key = ?').bind(key).run()).success
                        },
                    },
                    user: false,
                    session,
                    token,
                }

                for (const handler of middleware) await handler(parameters)

                return await handler(parameters)
            } catch (e) {
                console.error(e)
                return new Response(undefined, { status: 500 })
            }

        // Fallback browser requests to web client for client routing
        if (headers?.accept?.includes('text/html')) {
            url.pathname = '/'
            return environment.ASSETS.fetch(url)
        }

        return responses.notFound
    },
}
