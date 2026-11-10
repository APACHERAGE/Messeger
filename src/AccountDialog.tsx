import type { ReactNode } from 'react'
import { useDialogFocus } from './useDialogFocus'
import './account-dialog.css'
export default function AccountDialog({children,onClose,title}:{children:ReactNode;onClose:()=>void;title:string}) {
 const ref=useDialogFocus<HTMLDivElement>(onClose)
 return <div className="account-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div ref={ref} className="account-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>{children}</div></div>
}
