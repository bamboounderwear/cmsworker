import { router, Parameters, responses, time } from '../worker'
import { parse } from 'cookie'

export default function addSessionsRoutes() {
    router.get(`/api/session`, async (parameters: Parameters) => {
        if (!parameters.user) return responses.unauthorized
        return responses.json({ email: parameters.user })
    })

    router.post(`/api/session`, async (parameters: Parameters) => {
        // @ts-ignore
        const email = parameters?.body?.email
        // @ts-ignore
        const verification = parameters?.body?.verification ?? ''
        const now = time()

        const existing = await parameters.environment.DB.prepare(
            'select email from users where email = ? and verification = ? and verification_expires_at > ?'
        )
            .bind(email, verification, now)
            .first<string>('email')

        if (!existing) return responses.unauthorized

        await parameters.environment.DB.prepare('delete from sessions where email = ? and expires_at < ?').bind(email, now).run()
        const key = crypto.randomUUID()
        const expires_at = now + 259200 // 3 days

        await parameters.environment.DB.prepare('insert into sessions (key, email, expires_at) values (?, ?, ?)')
            .bind(key, email, expires_at)
            .run()
        return new Response(undefined, { status: 201, headers: { 'set-cookie': `session=${key}; SameSite=Strict` } })
    })

    router.delete(`/api/session`, async (parameters: Parameters) => {
        if (!parameters.user) return responses.unauthorized

        const { session } = parse(parameters.headers?.cookie ?? '')
        if (session)
            return responses.success(await parameters.environment.DB.prepare('delete from sessions where key = ?').bind(session).run())
        return responses.badRequest()
    })
}
