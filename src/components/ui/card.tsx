import React from 'react'
export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>){
  return <div className={["rounded-2xl bg-white shadow-sm border border-slate-100", className].join(' ')} {...props} />
}
export const CardHeader = ({ className='', ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={["p-4 border-b border-slate-100", className].join(' ')} {...p} />
export const CardContent = ({ className='', ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={["p-4", className].join(' ')} {...p} />
export const CardTitle = ({ className='', ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={["text-lg font-bold", className].join(' ')} {...p} />
export const CardDescription = ({ className='', ...p }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={["text-sm text-slate-500", className].join(' ')} {...p} />
export const CardFooter = ({ className='', ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={["p-4 border-t border-slate-100", className].join(' ')} {...p} />
