import { router, Parameters, responses, time } from '../worker'
import { Resend } from 'resend'

export default function addVerificationRoutes() {
    router.post(`/api/verification`, async (parameters: Parameters) => {
        if (parameters.environment.DEMO) return responses.unauthorized
        // @ts-ignore
        const email = parameters?.body?.email
        const now = time()
        const verification = crypto
            .getRandomValues(new Uint8Array(8))
            .map(value => value % 10)
            .join('')

        await parameters.environment.DB.prepare(
            'update users set verification = ?, verification_expires_at = ? where email = ? and (verification_expires_at is null or verification_expires_at <= ?)'
        )
            .bind(verification, now + 300, email, now)
            .run()

        if (parameters.environment.RESEND_KEY) {
            const resend = new Resend(parameters.environment.RESEND_KEY)
            const emailResult = await resend.emails.send({
                from: 'develop@resend.dev',
                to: email,
                subject: 'CMS Verification Code',
                text: `Verification code: ${verification}`,
            })
            if (emailResult.error) throw new Error(emailResult.error.message)
        } else console.log('New user verification:', { email, verification })

        return responses.noContent
    })
}
