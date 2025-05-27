import App from './components/app'
import { createRoot } from 'react-dom/client'
import { models } from './models'

if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')

window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root')
    if (!root) throw new Error('App root not found')
    createRoot(root).render(<App {...{ models }} />)
})
