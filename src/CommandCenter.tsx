import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Command, Search, Terminal, X } from 'lucide-react'
import { commandDefinitions } from './commands'
import { useDialogFocus } from './useDialogFocus'

type Props = {
  onClose: () => void
  onExecute: (command: string) => string | null
}

export default function CommandCenter({ onClose, onExecute }: Props) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const panelRef = useDialogFocus<HTMLDivElement>(onClose)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => {
    const needle = input.trim().replace(/^\/+/, '').toLowerCase()
    if (!needle || needle.includes(' ')) return commandDefinitions
    return commandDefinitions.filter(item => `${item.usage} ${item.description} ${item.group}`.toLowerCase().includes(needle))
  }, [input])

  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const command = input.trim()
    if (!command) return
    const result = onExecute(command)
    if (result === 'help') {
      setManualOpen(true)
      setOutput('')
    } else if (result === null) {
      onClose()
    } else {
      setOutput(result)
    }
  }

  function chooseCommand(usage: string) {
    if (usage.includes('<') || usage.includes('|')) {
      setInput(`${usage.split(' ')[0]} `)
      setOutput('')
      inputRef.current?.focus()
      return
    }
    const result = onExecute(usage)
    if (result === 'help') setManualOpen(true)
    else if (result === null) onClose()
    else setOutput(result)
  }

  return <div className="command-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="command-panel" role="dialog" aria-modal="true" aria-label="Command center" ref={panelRef} tabIndex={-1}>
      <header className="command-heading">
        <div className="command-mark"><Terminal size={17} /><span>COMMAND CENTER</span></div>
        <button className="icon-button" aria-label="Close command center" onClick={onClose}><X size={18} /></button>
      </header>
      {manualOpen ? <section className="command-manual">
        <button className="command-back" onClick={() => { setManualOpen(false); setOutput(''); inputRef.current?.focus() }}><ArrowLeft size={14} /> Back to command line</button>
        <p className="hub-kicker"><span /> USER GUIDE / APP COMMANDS</p>
        <h2>Nightfall commands</h2>
        <p className="command-manual-intro">Enter a command and press Enter. Commands control Nightfall sections and features only; they do not run system commands or access your computer's terminal.</p>
        <div className="command-manual-list">{commandDefinitions.map(item => <article key={item.usage}>
          <div><code>{item.usage}</code><span>{item.group}</span></div><p>{item.description}</p><small>Example: <code>{item.example}</code></small>
        </article>)}</div>
        <footer className="command-shortcut-note"><Command size={13} /> Open command center: Ctrl+K or ⌘K</footer>
      </section> : <>
        <form className="command-input-row" onSubmit={run}>
          <span aria-hidden="true">$</span>
          <input ref={inputRef} value={input} onChange={event => { setInput(event.target.value); setOutput('') }} placeholder="Enter a command, e.g. /threads" aria-label="Nightfall command" autoComplete="off" spellCheck={false} />
          <button type="submit" aria-label="Run command"><ArrowRight size={17} /></button>
        </form>
        {output && <p className="command-output" role="status">{output}</p>}
        <div className="command-list-heading"><span>AVAILABLE COMMANDS</span><button onClick={() => setManualOpen(true)}><BookOpen size={13} /> User guide</button></div>
        <div className="command-suggestions">
          {matches.map(item => <button key={item.usage} onClick={() => chooseCommand(item.usage)}>
            <span className="command-suggestion-icon"><Search size={14} /></span>
            <span><code>{item.usage}</code><small>{item.description}</small></span>
            <span className="command-group">{item.group}</span>
          </button>)}
          {!matches.length && <p className="command-no-match">No matches. Enter /help to view all commands.</p>}
        </div>
        <footer className="command-shortcut-note"><Command size={13} /> Enter — run <span>Esc — close</span><button onClick={() => setManualOpen(true)}>All commands <BookOpen size={13} /></button></footer>
      </>}
    </div>
  </div>
}
