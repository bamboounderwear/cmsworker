import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    headingsPlugin,
    imagePlugin,
    InsertImage,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    ListsToggle,
    MDXEditor,
    quotePlugin,
    toolbarPlugin,
    UndoRedo,
} from '@mdxeditor/editor'
import { client } from './app'

export default function EditorFieldMarkdown({
    value,
    update,
    addFile,
}: {
    value: string | undefined
    update: (value: any) => void
    addFile: (file: string) => void
}) {
    return (
        <MDXEditor
            plugins={[
                toolbarPlugin({
                    toolbarClassName: 'rich-toolbar',
                    toolbarContents: () => (
                        <>
                            <UndoRedo />
                            <BlockTypeSelect />
                            <BoldItalicUnderlineToggles />
                            <ListsToggle options={['bullet', 'number']} />
                            <CreateLink />
                            <InsertImage />
                        </>
                    ),
                }),
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                imagePlugin({
                    async imageUploadHandler(file) {
                        try {
                            const date = new Date()
                            const key = `${date.getFullYear()}/${date.getMonth() + 1}/${file.name}`
                            await client.upsertFile(key, file)

                            const url = new URL(window.location.href)
                            url.search = ''
                            url.pathname = `/files/${key}`
                            addFile(key)

                            return url.toString()
                        } catch (e) {
                            console.error(e)
                            alert('Cannot upload image.')
                        }
                        return ''
                    },
                }),
                linkPlugin(),
                linkDialogPlugin(),
            ]}
            markdown={value ?? ''}
            onChange={value => update(value)}
        />
    )
}
