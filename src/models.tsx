import { Model } from './components/app'
import { FileIcon, ProductsIcon, UserIcon } from './components/icons'

export const models: Model[] = [
    {
        name: 'pages',
        singularName: 'page',
        icon: <FileIcon />,
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'short, SEO-friendly page title' },
                description: { type: 'string' },
                attachment: { type: 'string', format: 'uri' },
                content: { type: 'string', format: 'markdown' },
            },
        },
        previewURL: () => {
            return '/test'
        },
        nameAlias: 'path',
    },
    {
        name: 'products',
        singularName: 'product',
        icon: <ProductsIcon />,
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string', format: 'markdown' },
                price: { type: 'number' },
                wasPrice: { type: 'number', title: 'original price', description: 'optional' },
                variants: {
                    type: 'array',
                    items: {
                        title: 'variant',
                        type: 'object',
                        properties: {
                            sku: { type: 'string' },
                            price: {
                                type: 'number',
                                description: 'optional price override',
                            },
                            options: {
                                type: 'array',
                                items: {
                                    title: 'option',
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        value: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        previewURL: () => {
            return '/test'
        },
    },
    {
        name: 'users',
        singularName: 'user',
        icon: <UserIcon />,
        schema: { type: 'object', properties: {}, description: 'Add user by email.' },
        allowGet: false,
        allowRename: false,
        allowUpdate: false,
        nameAlias: 'email',
    },
]
