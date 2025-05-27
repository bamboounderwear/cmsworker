import { router, Parameters, responses } from '../worker'

export default function addFilesRoutes() {
    router.head(`/files/*`, async (parameters: Parameters) => {
        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        const result = await parameters.environment.FILES.head(name)
        if (!result) return responses.notFound
        return responses.noContent
    })

    router.get(`/files/*`, async (parameters: Parameters) => {
        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        const result = await parameters.environment.FILES.get(name)
        if (!result) return responses.notFound
        // @ts-ignore
        return new Response(result.body, { headers: { 'content-type': result.customMetadata?.content_type } })
    })

    router.put(`/api/files/*`, async (parameters: Parameters) => {
        if (!parameters.user || parameters.environment.DEMO) return responses.unauthorized
        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        // @ts-ignore
        const result = await parameters.environment.FILES.put(name, parameters.body, {
            customMetadata: { content_type: parameters.headers['content-types'] },
        })
        if (!result) throw new Error('Unable to upsert file.')
        return responses.noContent
    })

    router.delete(`/api/files/*`, async (parameters: Parameters) => {
        if (!parameters.user || parameters.environment.DEMO) return responses.unauthorized
        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound
        await parameters.environment.FILES.delete(name)
        return responses.noContent
    })
}
