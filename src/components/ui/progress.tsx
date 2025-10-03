import React from 'react'
export function Progress({ value=0 }: { value?: number }){
  return (
    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
      <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
