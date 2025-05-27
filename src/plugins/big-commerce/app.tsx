import { client, Model } from '../../components/app'
import { models } from '../../models'
import { ProductsIcon, SettingsIcon } from '../../components/icons'

export default function initializeBCAPP() {
    const params = new URLSearchParams(window.location.search)
    if (params.has('signed_payload_jwt')) {
        client.headers.authorization = `Bearer ${params.get('signed_payload_jwt')}`

        const usersIndex = models.findIndex(({ name }) => name === 'users')
        models.splice(usersIndex, 1)
    }

    const products: Model = {
        name: 'products',
        singularName: 'product',
        icon: <ProductsIcon />,
        schema: {
            type: 'object',
            properties: {},
        },
    }

    models.push(products)

    models.push({
        name: 'configuration',
        singularName: 'configuration',
        icon: <SettingsIcon />,
        allowList: false,
        schema: {
            type: 'object',
            properties: {},
        },
    })
}
