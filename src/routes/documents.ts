import { router, Parameters, responses, controllers } from '../worker'
import { documentsController } from '../controllers/default'

export function addDocumentsRoutes() {
    router.head(`/api/:model/*`, async (parameters: Parameters) => {
        if (!parameters.user) return responses.unauthorized

        const model = parameters.parameters?.model
        if (!model) return responses.notFound

        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        const controller = controllers[model] ?? documentsController
        if (!controller.exists) throw new Error('Document exists not implemented.')
        const result = await controller.exists({ model, name }, parameters)

        if (!result) return responses.notFound
        return responses.noContent
    })

    router.get('/api/:model', async (parameters: Parameters) => {
        if (!parameters.user) return responses.unauthorized
        const model = parameters.parameters?.model
        if (!model) return responses.notFound
        const controller = controllers[model] ?? documentsController

        const search = parameters.queries?.search
        const limit = parameters.queries?.limit ? Number(parameters.queries.limit) : search ? 10 : 20
        const after = parameters.queries?.after
            ? isNaN(Number(parameters.queries.after))
                ? parameters.queries.after
                : Number(parameters.queries.after)
            : undefined

        if (!controller.list) throw new Error('List documents not implemented.')
        const result = await controller.list({ model, search, limit, after }, parameters)

        const headers = {}
        if (result.last) headers['x-last'] = result.last
        return responses.json(result.results, headers)
    })

    router.get(`/api/:model/*`, async (parameters: Parameters) => {
        if (!parameters.user) return responses.unauthorized
        const model = parameters.parameters?.model
        if (!model) return responses.notFound
        const controller = controllers[model] ?? documentsController
        const name = decodeURI(parameters.parameters['*'] ?? '')

        if (!controller.get) throw new Error('Get document not implemented.')
        const result = await controller.get({ model, name }, parameters)

        if (result instanceof Response) return result
        if (!result) return responses.notFound
        return responses.json(result)
    })

    router.put(`/api/:model/*`, async (parameters: Parameters) => {
        if (!parameters.user || parameters.environment.DEMO) return responses.unauthorized

        const model = parameters.parameters?.model
        if (!model) return responses.notFound

        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        const rename = parameters.queries?.rename
        const move = parameters.queries?.move
        const value = parameters.body ?? parameters.request.body
        if (!value) return responses.badRequest('Request body is required.')

        const controller = controllers[model] ?? documentsController
        if (!controller.put) throw new Error('Document update not implemented.')
        if (!(await controller.put({ model, name, rename, value, modified_by: parameters.user, move }, parameters)))
            throw new Error('Unable to update document.')
        return responses.noContent
    })

    router.delete(`/api/:model/*`, async (parameters: Parameters) => {
        if (!parameters.user || parameters.environment.DEMO) return responses.unauthorized

        const model = parameters.parameters?.model
        if (!model) return responses.notFound

        const name = decodeURI(parameters.parameters['*'] ?? '')
        if (!name) return responses.notFound

        const controller = controllers[model] ?? documentsController
        if (!controller.delete) throw new Error('Document delete not implemented.')
        if (!(await controller.delete({ model, name }, parameters))) return responses.notFound
        return responses.noContent
    })
}
