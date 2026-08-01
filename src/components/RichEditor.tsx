import React, { useRef, useEffect } from "react";
import { Bold, Italic, Underline, Strikethrough, Heading2, List, ListOrdered, RemoveFormatting } from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
}

export default function RichEditor({ value, onChange, minHeight = 120, placeholder }: RichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value into the contentEditable only when it changes outside
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const run = (command: string, arg?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, arg);
    } catch {
      // execCommand may be unavailable in rare contexts
    }
    onChange(el.innerHTML);
  };

  const btn = "p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center";

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-zinc-800 bg-zinc-950">
        <button type="button" className={btn} onClick={() => run("bold")} title="Gras"><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => run("italic")} title="Italique"><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => run("underline")} title="Souligné"><Underline className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => run("strikeThrough")} title="Barré"><Strikethrough className="w-3.5 h-3.5" /></button>
        <span className="w-px h-5 bg-zinc-800 mx-1" />
        <button type="button" className={btn} onClick={() => run("formatBlock", "<h2>")} title="Sous-titre"><Heading2 className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => run("insertUnorderedList")} title="Liste à puces"><List className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => run("insertOrderedList")} title="Liste numérotée"><ListOrdered className="w-3.5 h-3.5" /></button>
        <span className="w-px h-5 bg-zinc-800 mx-1" />
        <button type="button" className={btn} onClick={() => run("removeFormat")} title="Retirer le format"><RemoveFormatting className="w-3.5 h-3.5" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
        className="px-3 py-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-brand-red/40 rounded-b-xl [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-zinc-600 [&:empty:before]:italic"
        style={{ minHeight }}
      />
    </div>
  );
}
