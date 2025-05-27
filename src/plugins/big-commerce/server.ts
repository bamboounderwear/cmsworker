import { router, Parameters, responses, middleware } from '../../worker'
import { verify } from '@tsndr/cloudflare-worker-jwt'

const key = 'bigcommerce-store'

export function addBCRoutes() {
    router.get('/install', async (parameters: Parameters) => {
        if (!parameters.environment?.BIGCOMMERCE_CLIENT_ID || !parameters.environment.BIGCOMMERCE_CLIENT_SECRET)
            return responses.badRequest('Missing environment variables.')

        const code = parameters.queries?.code
        const context = parameters.queries?.context
        const scope = parameters.queries?.scope
        if (!code || !context || !scope) return responses.badRequest('Missing required query parameters.')

        const hash = context.split('/')[1]
        if (!hash) return responses.badRequest('Missing store hash.')

        const url = new URL(parameters.url)
        url.pathname = '/install'
        url.search = ''
        url.protocol = 'https'

        const tokenRequest = await fetch('https://login.bigcommerce.com/oauth2/token', {
            method: 'post',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                client_id: parameters.environment.BIGCOMMERCE_CLIENT_ID,
                client_secret: parameters.environment.BIGCOMMERCE_CLIENT_SECRET,
                code,
                context,
                scope,
                grant_type: 'authorization_code',
                redirect_uri: url.toString(),
            }),
        })
        console.log(`POST https://login.bigcommerce.com/oauth2/token - ${tokenRequest.status} ${tokenRequest.statusText}`)
        if (!tokenRequest.ok) throw new Error('Unable to obtain BigCommerce access token.')
        const token = (await tokenRequest.json()) as {
            access_token: string
            user: {
                email: string
            }
            owner: {
                email: string
            }
            context: string
        }

        if (!(await parameters.cache.put(key, { hash, token: token.access_token })))
            throw new Error('Unable to complete store installation.')
        return new Response(undefined, { status: 302, headers: { location: '/' } })
    })

    router.get('/uninstall', async (parameters: Parameters) => {
        if (!parameters?.store) return responses.unauthorized
        await parameters.cache.delete(key)
    })
}

export function addBCAuthentication() {
    middleware.push(async parameters => {
        if (parameters.token) {
            const decoded = (await verify(parameters.token, parameters.environment.BIGCOMMERCE_CLIENT_SECRET)) as {
                payload: {
                    sub: string
                    user: {
                        email: string
                    }
                }
            }
            if (decoded) {
                parameters.user = decoded.payload.user.email
                const store = await parameters.cache.get(key)
                if (store) parameters.store = new BigCommerceStore(store.hash, store.token)
            }
        }
    })
}

type FetchParameters = {
    method?: 'get' | 'post' | 'put' | 'delete'
    body?: any
    queries?: Record<string, any>
    raw?: boolean
}

export class BigCommerceStore {
    hash
    token

    constructor(hash: string, token: string) {
        this.hash = hash
        this.token = token
    }

    async fetch(endpoint: string, params?: FetchParameters) {
        const url = new URL(`https://api.bigcommerce.com/stores/${this.hash}/${endpoint}`)
        Object.entries(params?.queries ?? {}).forEach(([name, value]) => {
            if (name && value) url.searchParams.append(name, value)
        })
        const headers = {
            accept: 'application/json',
            'x-auth-token': this.token,
        }
        if (params?.body) headers['content-type'] = 'application/json'
        let request
        for (let tries = 0; tries < 3; tries++) {
            request = await fetch(url, {
                method: params?.method,
                body: params?.body ? JSON.stringify(params.body) : undefined,
                headers,
            })
            console.log(`${(params?.method ?? 'get').toUpperCase()} ${url.toString()} - ${request.status} ${request.statusText}`)
            if (!request.ok) {
                if (request.status >= 500) continue
                else break
            }
            if (request.status === 204) return
            const result = await request.json()
            if (result.data && !params?.raw) return result.data
            return result
        }
        throw new Error(
            `BigCommerce fetch error - ${(params?.method ?? 'get').toUpperCase()} ${request.status} ${
                request.statusText
            } ${await request.text()}`
        )
    }

    async get(endpoint: string, params?: FetchParameters) {
        return this.fetch(endpoint, { ...params, method: 'get' })
    }

    async getAll(endpoint: string, params?: FetchParameters) {
        const results = []
        let total_pages = 1
        for (let page = 1; page <= total_pages; page++) {
            const current: any = await this.fetch(endpoint, {
                ...params,
                queries: {
                    ...(params?.queries ?? {}),
                    page,
                },
                raw: true,
            })
            // v3 pagination
            if (current?.meta?.pagination?.total_pages)
                // TODO: Implement batchRequests to get remaining pages & exit loop early
                total_pages = current?.meta?.pagination?.total_pages
            // v2 pagination
            else if (current?.length === (params?.queries?.limit ?? 50)) total_pages++
            if (Array.isArray(current?.data ?? current))
                // @ts-ignore current || current.data is an array at this point
                results.push(...(current?.data ? current.data : current))
        }
        return results
    }

    async post(endpoint: string, params?: FetchParameters) {
        return this.fetch(endpoint, { ...params, method: 'post' })
    }

    async put(endpoint: string, params?: FetchParameters) {
        return this.fetch(endpoint, { ...params, method: 'put' })
    }

    async delete(endpoint: string, params?: FetchParameters) {
        return this.fetch(endpoint, { ...params, method: 'delete' })
    }

    /**
     * Make batches of requests for high concurrency
     * @param requests Requests to batch
     * @param concurrency Amount of concurrent request to make
     */
    async batchRequests(requests: (() => Promise<any>)[], concurrency: number) {
        const results: any[] = []
        const pages = Math.ceil(requests.length / concurrency)
        for (let page = 0; page < pages; page++) {
            console.log(`BATCH: ${page + 1}`)
            const i = page * concurrency
            results.push(...(await Promise.all(requests.slice(i, i + concurrency).map(request => request()))))
        }
        return results
    }
}
