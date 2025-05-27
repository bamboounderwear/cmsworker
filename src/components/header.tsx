import React, { useState, useEffect, useCallback } from 'react'
import { client } from './app'
import { MoonIcon, SunIcon } from './icons' // Import new icons

export default function Header({ setAuthenticated }: { setAuthenticated: (value: boolean) => void }) {
    const [loggingOut, setLoggingOut] = useState<boolean>(false)
    const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light')

    const toggleTheme = useCallback(() => {
        if (theme === 'dark') return setTheme('light')
        setTheme('dark')
    }, [theme, setTheme])

    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', theme)
    }, [theme])

    return (
        <header className="px-4 py-2 bg-neutral-800 text-white grid gap-2 grid-cols-[auto,max-content]">
            <span></span>
            <div className="flex gap-4 items-center">
                <button
                    onClick={toggleTheme}
                    className="text-white bg-transparent border-none p-1 hover:bg-neutral-700"
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
                <span className="select-none text-sm">{client.email}</span>
                <button
                    onClick={async e => {
                        setLoggingOut(true)
                        setAuthenticated(!(await client.deleteSession()))
                        setLoggingOut(false)
                    }}
                    disabled={loggingOut}
                    className="text-black dark:text-white bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 py-1 text-xs"
                >
                    {loggingOut ? 'logging out...' : 'logout'}
                </button>
            </div>
        </header>
    )
}
