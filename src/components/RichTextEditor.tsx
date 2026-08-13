import { useEffect, useRef, useState, type ReactNode } from 'react'

const VARIABLES = ['nombre', 'apellido', 'nombre_completo', 'email', 'telefono', 'consulta', 'empresa']

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const [tab, setTab] = useState<'visual' | 'html'>('visual')
  const editableRef = useRef<HTMLDivElement>(null)
  // arranca en null (no en `value`) a propósito: si arrancara igual a `value`, el
  // primer efecto lo vería como "sin cambios" y nunca pintaría el contenido inicial.
  const lastEmitted = useRef<string | null>(null)

  useEffect(() => {
    if (tab === 'visual' && editableRef.current && value !== lastEmitted.current) {
      editableRef.current.innerHTML = value
      lastEmitted.current = value
    }
  }, [value, tab])

  function syncFromEditable() {
    if (!editableRef.current) return
    const html = editableRef.current.innerHTML
    lastEmitted.current = html
    onChange(html)
  }

  function runCommand(command: string, arg?: string) {
    editableRef.current?.focus()
    document.execCommand(command, false, arg)
    syncFromEditable()
  }

  function insertLink() {
    const url = window.prompt('URL del link:')
    if (url) runCommand('createLink', url)
  }

  function insertVariable(key: string) {
    runCommand('insertText', `{{${key}}}`)
  }

  return (
    <div className="rounded-md border border-brand-line overflow-hidden">
      <div className="flex items-center justify-between bg-brand-cream border-b border-brand-line px-2 py-1">
        <div className="flex gap-1">
          <TabButton active={tab === 'visual'} onClick={() => setTab('visual')}>
            Visual
          </TabButton>
          <TabButton active={tab === 'html'} onClick={() => setTab('html')}>
            HTML
          </TabButton>
        </div>
        {tab === 'visual' && (
          <div className="flex items-center gap-1">
            <ToolButton onMouseDown={() => runCommand('bold')} label="Negrita">
              <strong>B</strong>
            </ToolButton>
            <ToolButton onMouseDown={() => runCommand('italic')} label="Cursiva">
              <em>I</em>
            </ToolButton>
            <ToolButton onMouseDown={() => runCommand('underline')} label="Subrayado">
              <span className="underline">U</span>
            </ToolButton>
            <ToolButton onMouseDown={() => runCommand('insertUnorderedList')} label="Lista">
              •≡
            </ToolButton>
            <ToolButton onMouseDown={insertLink} label="Insertar link">
              🔗
            </ToolButton>
            <select
              onChange={(e) => {
                if (e.target.value) insertVariable(e.target.value)
                e.target.value = ''
              }}
              defaultValue=""
              className="rounded border border-brand-line bg-white px-1.5 py-1 text-xs"
              title="Insertar variable"
            >
              <option value="" disabled>
                + variable
              </option>
              {VARIABLES.map((v) => (
                <option key={v} value={v}>
                  {`{{${v}}}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab === 'visual' ? (
        <div
          ref={editableRef}
          contentEditable
          onInput={syncFromEditable}
          onBlur={syncFromEditable}
          className="min-h-[140px] px-3 py-2 text-sm focus:outline-none"
          suppressContentEditableWarning
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => {
            lastEmitted.current = e.target.value
            onChange(e.target.value)
          }}
          rows={7}
          className="w-full min-h-[140px] px-3 py-2 text-xs font-mono focus:outline-none"
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium ${
        active ? 'bg-white text-brand-carbon shadow-sm' : 'text-brand-gray hover:text-brand-carbon'
      }`}
    >
      {children}
    </button>
  )
}

function ToolButton({
  onMouseDown,
  label,
  children,
}: {
  onMouseDown: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown()
      }}
      className="rounded border border-brand-line bg-white w-7 h-7 flex items-center justify-center text-xs hover:bg-brand-cream"
    >
      {children}
    </button>
  )
}
