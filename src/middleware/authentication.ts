import { middleware, time } from '../worker'

export function addSessionAuthentication() {
    middleware.push(async parameters => {
        if (parameters.session)
            parameters.user =
                (await parameters.environment.DB.prepare(
                    'select sessions.email from sessions inner join users on users.email = sessions.email where sessions.key = ? and sessions.expires_at > ?'
                )
                    .bind(parameters.session, time())
                    .first<string>('email')) ?? false
    })
}

export function addTokenAuthentication() {
    middleware.push(async parameters => {
        if (!parameters.user && parameters.token)
            parameters.user =
                (await parameters.environment.DB.prepare('select email from users where key = ?')
                    .bind(parameters.token)
                    .first<string>('email')) ?? false
    })
}
