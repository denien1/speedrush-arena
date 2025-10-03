import React from 'react'
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className='', ...p}, ref){
  return <input ref={ref} className={["h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-inner", className].join(' ')} {...p} />
})
