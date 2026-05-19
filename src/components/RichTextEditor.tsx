"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { TextStyleKit } from "@tiptap/extension-text-style"
import FontFamily from "@tiptap/extension-font-family"
import { Extension } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import { useEffect, useRef, useState, useCallback } from "react"
import { useLanguage } from "@/components/LanguageProvider"
import { t } from "@/lib/i18n"

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (attrs) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
})

const ResizableImage = Image.configure({ allowBase64: true }).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {} },
      height: { default: null, renderHTML: (attrs) => attrs.height ? { height: attrs.height } : {} },
    }
  },
})

type Props = {
  value: string
  onChange: (html: string) => void
  showVariables?: boolean
}

export default function RichTextEditor({ value, onChange, showVariables = true }: Props) {
  const { lang } = useLanguage()
  const [colorInput, setColorInput] = useState("#000000")
  const [imageWidth, setImageWidth] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const VARIABLES = [
    { label: t("var_salutation", lang), value: "{{anrede}}" },
    { label: t("var_firstname", lang),  value: "{{vorname}}" },
    { label: t("var_lastname", lang),   value: "{{nachname}}" },
    { label: "Email",                   value: "{{email}}" },
    { label: t("var_company", lang),    value: "{{firmenname}}" },
    { label: "Variable 1",              value: "{{var1}}" },
    { label: "Variable 2",              value: "{{var2}}" },
    { label: "Variable 3",              value: "{{var3}}" },
  ]

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyleKit, FontFamily, FontSize, ResizableImage],
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
    <div className="border rounded overflow-hidden text-sm bg-gray-200 text-gray-900">
      <div className="flex flex-wrap gap-1 p-2 bg-gray-100 border-b">
        <select
          onChange={(e) => {
            if (e.target.value === "") {
              editor.chain().focus().unsetFontFamily().run()
            } else {
              editor.chain().focus().setFontFamily(e.target.value).run()
            }
          }}
          className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white text-gray-700"
          defaultValue=""
        >
          <option value="">{t("font_default", lang)}</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="Calibri, sans-serif">Calibri</option>
        </select>

        <select
          onChange={(e) => {
            if (e.target.value === "") {
              editor.chain().focus().setMark("textStyle", { fontSize: null }).run()
            } else {
              editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run()
            }
          }}
          className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white text-gray-700"
          defaultValue=""
        >
          <option value="">{t("font_size", lang)}</option>
          {[8,10,11,12,14,16,18,20,24,28,32,36,48].map((s) => (
            <option key={s} value={`${s}pt`}>{s}pt</option>
          ))}
        </select>

        <div className="w-px bg-gray-300 mx-1" />

        {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),      t("btn_bold", lang),      <b>B</b>)}
        {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),    t("btn_italic", lang),    <i>I</i>)}
        {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), t("btn_underline", lang), <u>U</u>)}

        <div className="w-px bg-gray-300 mx-1" />

        {btn(editor.isActive("bulletList"),  () => editor.chain().focus().toggleBulletList().run(),  t("btn_bullet", lang),  <span>• {lang === "de" ? "Liste" : "List"}</span>)}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), t("btn_ordered", lang), <span>1. {lang === "de" ? "Liste" : "List"}</span>)}

        <div className="w-px bg-gray-300 mx-1" />

        <div className="flex items-center gap-1">
          <input
            type="color"
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
            title={t("color_pick", lang)}
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
            title={t("color_apply", lang)}
          >
            A
          </button>
          <button
            type="button"
            title={t("color_reset", lang)}
            onClick={() => { editor.chain().focus().unsetColor().run(); setColorInput("#000000") }}
            className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="w-px bg-gray-300 mx-1" />

        <button
          type="button"
          title={t("insert_image", lang)}
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded text-xs border border-gray-300 bg-white hover:bg-gray-100"
        >
          {t("image_btn", lang)}
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

        {editor.isActive("image") && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">{t("image_width", lang)}</span>
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

        {showVariables && (
          <>
            <span className="text-xs text-gray-500 self-center">{t("variable_label", lang)}</span>
            {VARIABLES.map((v) => (
              <button
                key={v.value}
                type="button"
                title={`${t("variable_label", lang)} ${v.value}`}
                onClick={() => editor.chain().focus().insertContent(v.value).run()}
                className="px-2 py-1 rounded text-xs border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                {"{{"}{v.label}{"}}"}
              </button>
            ))}
          </>
        )}
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[120px] p-3 focus-within:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
      />
    </div>
  )
}
