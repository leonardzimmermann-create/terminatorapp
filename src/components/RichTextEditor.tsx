"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { TextStyleKit } from "@tiptap/extension-text-style"
import Image from "@tiptap/extension-image"
import { useEffect, useRef, useState, useCallback } from "react"

// Image extension mit width/height-Unterstützung und Base64-Erlaubnis
const ResizableImage = Image.configure({ allowBase64: true }).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {} },
      height: { default: null, renderHTML: (attrs) => attrs.height ? { height: attrs.height } : {} },
    }
  },
})

const VARIABLES = [
  { label: "Anrede", value: "{{anrede}}" },
  { label: "Vorname", value: "{{vorname}}" },
  { label: "Nachname", value: "{{nachname}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Firmenname", value: "{{firmenname}}" },
]

type Props = {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: Props) {
  const [colorInput, setColorInput] = useState("#000000")
  const [imageWidth, setImageWidth] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyleKit, ResizableImage],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  const applyImageWidth = useCallback((width: string) => {
    const w = parseInt(width)
    if (!isNaN(w) && w > 0) {
      editor?.chain().focus().updateAttributes("image", { width: w, height: null }).run()
    }
  }, [editor])

  const handleImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      editor?.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(file)
  }

  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, title: string, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm border ${
        active ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="border rounded overflow-hidden text-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-100 border-b">
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Fett", <b>B</b>)}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Kursiv", <i>I</i>)}
        {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Unterstrichen", <u>U</u>)}

        <div className="w-px bg-gray-300 mx-1" />

        {/* Farbe per HEX */}
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
            title="Farbe wählen"
          />
          <input
            type="text"
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") editor.chain().focus().setColor(colorInput).run()
            }}
            placeholder="#000000"
            className="w-20 border border-gray-300 rounded px-1 py-0.5 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => editor.chain().focus().setColor(colorInput).run()}
            className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
            title="Farbe anwenden"
          >
            A
          </button>
          <button
            type="button"
            title="Farbe zurücksetzen"
            onClick={() => { editor.chain().focus().unsetColor().run(); setColorInput("#000000") }}
            className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="w-px bg-gray-300 mx-1" />

        {/* Bild einfügen */}
        <button
          type="button"
          title="Bild / Logo einfügen"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
        >
          🖼 Bild
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImageFile(file)
            e.target.value = ""
          }}
        />

        {/* Bildgröße — nur sichtbar wenn Bild ausgewählt */}
        {editor.isActive("image") && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Breite:</span>
            <input
              type="number"
              min={10}
              max={1200}
              value={imageWidth}
              onChange={(e) => setImageWidth(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyImageWidth(imageWidth) }}
              placeholder="px"
              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs"
            />
            <button
              type="button"
              onClick={() => applyImageWidth(imageWidth)}
              className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
            >
              ✓
            </button>
          </div>
        )}

        <div className="w-px bg-gray-300 mx-1" />

        {/* Variablen */}
        <span className="text-xs text-gray-500 self-center">Variable:</span>
        {VARIABLES.map((v) => (
          <button
            key={v.value}
            type="button"
            title={`Variable einfügen: ${v.value}`}
            onClick={() => editor.chain().focus().insertContent(v.value).run()}
            className="px-2 py-1 rounded text-xs border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            {"{{"}{v.label}{"}}"}
          </button>
        ))}
      </div>

      {/* Editor-Fläche */}
      <EditorContent
        editor={editor}
        className="min-h-[120px] p-3 focus-within:outline-none prose prose-sm max-w-none"
      />
    </div>
  )
}
