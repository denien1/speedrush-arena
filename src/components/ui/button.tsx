import React from 'react'
export function Button({ className = '', variant = 'default', size = 'md', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'secondary', size?: 'sm'|'md'|'lg' }){
  const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-2 font-medium shadow-sm active:scale-[.99] disabled:opacity-50'
  const v = variant === 'secondary' ? 'bg-white text-slate-900 border border-slate-200' : 'bg-slate-900 text-white'
  const s = size === 'lg' ? 'text-base h-11 px-5' : size === 'sm' ? 'text-sm h-8 px-3' : 'text-sm h-10'
  return <button className={[base, v, s, className].join(' ')} {...props} />
}
