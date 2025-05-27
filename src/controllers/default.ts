import { Controller, time } from '../worker'

export function queryPrefix(prefix: string, name = 'name') {
    const query = [`${name} like ?`]
    const bindings = [`${prefix}%`]
    const addBinding = prefix => {
        query.push(`${name} like ?`)
        bindings.push(prefix)
    }

    for (let i = prefix.length - 1; i >= 0; i--) {
        const copy = prefix.split('')
        copy[i] = '%'

        if (i === prefix.length - 1) {
            if (prefix.length > 1) {
                addBinding(`${copy.join('')}`)
            }
        } else {
            addBinding(`${copy.join('')}%`)
        }
    }
    addBinding(`%${prefix}%`)

    return { query: query.join(' or '), bindings }
}

export const documentsController: Controller = {
    async list({ model, search, limit, after }, { environment: { DB } }) {
        const prefixQuery = search ? queryPrefix(search) : undefined
        const { results } = await DB.prepare(
            `select rowid, name, modified_at from documents where model = ?${
                prefixQuery ? ` and (${prefixQuery.query})` : ''
            } and rowid > ? order by name, rowid limit ?`
        )
            .bind(...[model, ...(prefixQuery ? prefixQuery.bindings : []), after || 0, limit].filter(parameter => parameter !== undefined))
            .all<{
                rowid: number
                name: string
                modified_at: number
            }>()

        return {
            results: results.map(document => ({
                ...document,
                rowid: undefined,
                modified_at: new Date(document.modified_at * 1000).toLocaleDateString(),
            })),
            last: results.length === limit ? results[results.length - 1]?.rowid?.toString() : undefined,
        }
    },
    async exists({ model, name }, { environment: { DB } }) {
        return Boolean(
            await DB.prepare('select rowid from documents where model = ? and name = ?').bind(model, name).first<{ rowid: number }>()
        )
    },
    async get({ model, name }, { environment: { DB } }) {
        const result = await DB.prepare('select rowid, value, modified_at from documents where model = ? and name = ?')
            .bind(model, name)
            .first<{ rowid: number; value: string; modified_at: number }>()
        if (!result) return

        const value = {
            ...JSON.parse(result.value),
            _modified_at: result.modified_at,
            _model: model,
            _name: name,
            _id: result.rowid,
        }
        return value
    },
    async put({ model, name, rename, value, modified_by }, { environment: { DB } }) {
        let existing = await DB.prepare('select rowid from documents where model = ? and name = ?')
            .bind(model, name)
            .first<{ rowid: number }>()
        if (rename && !existing) throw new Error('Cannot rename non-existant document.')

        const now = time()
        const serializedValue = JSON.stringify({
            ...value,
            _modified_at: now,
            _model: model,
            _name: name,
        })

        if (existing) {
            return (
                await DB.prepare('update documents set name = ?, value = ?, modified_at = ?, modified_by = ? where rowid = ?')
                    .bind(rename ?? name, serializedValue, now, modified_by, existing.rowid)
                    .run()
            ).success
        } else {
            return (
                await DB.prepare('insert into documents (model, name, value, modified_at, modified_by) values (?, ?, ?, ?, ?)')
                    .bind(model, name, serializedValue, now, modified_by)
                    .run()
            ).success
        }
    },
    async delete({ model, name }, { environment: { DB } }) {
        return (await DB.prepare('delete from documents where model = ? and name = ?').bind(model, name).run()).success
    },
}

export const usersController: Controller = {
    async list({ search }, { environment: { DB } }) {
        const prefixQuery = search ? queryPrefix(search, 'email') : undefined
        const { results } = await DB.prepare(`select email from users ${prefixQuery ? `where (${prefixQuery.query})` : ''} order by email`)
            .bind(...[...(prefixQuery ? prefixQuery.bindings : [])].filter(parameter => parameter !== undefined))
            .all<{
                email: string
            }>()

        return {
            results: results.map(({ email }) => ({ name: email })),
        }
    },
    async exists({ name }, { environment: { DB } }) {
        const existing = await DB.prepare('select email from users where email = ?').bind(name).first('email')
        return Boolean(existing)
    },
    async put({ name }, { environment: { DB } }) {
        const existing = await DB.prepare('select email from users where email = ?').bind(name).first<string>('email')
        if (existing) return false
        return (await DB.prepare('insert into users (email, key) values (?, ?)').bind(name, crypto.randomUUID()).run()).success
    },
    async delete({ name }, { environment: { DB } }) {
        return (await DB.prepare('delete from users where email = ?').bind(name).run()).success
    },
}
