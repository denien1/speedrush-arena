import React, { useState } from 'react'
export function Tabs({ defaultValue, children, className='' }: { defaultValue: string, children: React.ReactNode, className?: string }){
  const [value, setValue] = useState(defaultValue)
  const childrenArray = React.Children.toArray(children) as any[]
  return <div className={className}>
    {childrenArray.map((child: any) => React.cloneElement(child, { value, setValue }))}
  </div>
}
export const TabsList = ({ children, className='' }: any) => <div className={["grid gap-2 rounded-xl bg-slate-100 p-1", className].join(' ')}>{children}</div>
export const TabsTrigger = ({ children, value: my, value, setValue }: any) => (
  <button onClick={()=>setValue(my)} className={`rounded-xl px-3 py-2 text-sm ${value===my? 'bg-white shadow font-semibold' : 'text-slate-600'}`}>{children}</button>
)
export const TabsContent = ({ value: my, value, children }: any) => value===my ? <div className="mt-3">{children}</div> : null
