import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  /** `portal` = light client portal; `dark` = legacy dark panels */
  variant?: "portal" | "dark";
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  variant,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  title: string;
  variant: "portal" | "dark";
}) {
  const inactive =
    variant === "portal"
      ? "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      : "text-ink-muted hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "rounded p-1.5 transition",
        active ? "bg-accent-gold/20 text-accent-gold" : inactive,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "200px",
  variant = "dark",
}: RichTextEditorProps) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-brand-lime underline" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write your message here...",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          variant === "portal"
            ? "prose prose-sm max-w-none text-zinc-900 focus:outline-none"
            : "prose prose-invert prose-sm max-w-none focus:outline-none",
        style: `min-height: ${minHeight}`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  useEffect(() => {
    if (linkPopoverOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [linkPopoverOpen]);

  if (!editor) return null;

  function normalizeUrl(rawUrl: string) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function openLinkPopover() {
    const existingHref = editor.getAttributes("link").href as string | undefined;
    setLinkInput(existingHref ?? "");
    setLinkPopoverOpen(true);
  }

  function saveLink() {
    const normalizedUrl = normalizeUrl(linkInput);
    if (!normalizedUrl) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    setLinkPopoverOpen(false);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkPopoverOpen(false);
  }

  const shell =
    variant === "portal"
      ? "overflow-hidden rounded-xl border border-zinc-300 bg-white"
      : "overflow-hidden rounded-xl border border-white/10 bg-black/30";
  const toolbar =
    variant === "portal"
      ? "relative flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5"
      : "relative flex flex-wrap items-center gap-0.5 border-b border-white/10 bg-black/20 px-2 py-1.5";
  const divider = variant === "portal" ? "mx-1 h-4 w-px bg-zinc-300" : "mx-1 h-4 w-px bg-white/20";
  const linkPopoverShell =
    variant === "portal"
      ? "absolute right-2 top-[calc(100%+0.4rem)] z-20 w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-3 shadow-lg"
      : "absolute right-2 top-[calc(100%+0.4rem)] z-20 w-full max-w-sm rounded-xl border border-white/10 bg-[#12181f] p-3 shadow-glass ring-1 ring-black/40";
  const linkLabel =
    variant === "portal"
      ? "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-600"
      : "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle";
  const linkInputClass =
    variant === "portal"
      ? "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold/30"
      : "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25";
  const linkGhostBtn =
    variant === "portal"
      ? "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
      : "rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-white/[0.06] hover:text-white";
  const linkApplyBtn =
    variant === "portal"
      ? "rounded-lg bg-accent-gold px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
      : "rounded-lg bg-brand-lime px-3 py-1.5 text-xs font-semibold text-canvas transition hover:bg-brand-lime-dim";

  return (
    <div className={shell}>
      <div className={toolbar}>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 11h4.5a2.5 2.5 0 0 0 0-5H8v5Zm10 4.5a4.5 4.5 0 0 1-4.5 4.5H6V4h6.5a4.5 4.5 0 0 1 3.256 7.606A4.5 4.5 0 0 1 18 15.5ZM8 13v5h5.5a2.5 2.5 0 0 0 0-5H8Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 20H7v-2h2.927l2.116-12H9V4h8v2h-2.927l-2.116 12H15v2Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 3v9a4 4 0 0 0 8 0V3h2v9a6 6 0 0 1-12 0V3h2ZM4 20h16v2H4v-2Z" />
          </svg>
        </ToolbarButton>

        <div className={divider} />

        <ToolbarButton
          variant={variant}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>

        <div className={divider} />

        <ToolbarButton
          variant={variant}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 4h13v2H8V4ZM4.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM8 11h13v2H8v-2Zm0 7h13v2H8v-2Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 4h13v2H8V4ZM5 3v3h1v1H3V6h1V4H3V3h2Zm-2 7h3.5v1H4v1h1.5v1H3v-4h2v1Zm2 7H3v-1h2v-.5H3v-1h2v-.5H3v-1h3v4Zm3-4h11v2H8v-2Zm0 7h11v2H8v-2Z" />
          </svg>
        </ToolbarButton>

        <div className={divider} />

        <ToolbarButton
          variant={variant}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          variant={variant}
          active={editor.isActive("link")}
          onClick={openLinkPopover}
          title="Insert Link"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.364 15.536 16.95 14.12l1.414-1.414a5 5 0 1 0-7.071-7.071L9.878 7.05 8.464 5.636l1.414-1.414a7 7 0 0 1 9.9 9.9l-1.414 1.414Zm-2.828 2.828-1.415 1.414a7 7 0 0 1-9.9-9.9l1.415-1.414L7.05 9.88l-1.414 1.414a5 5 0 1 0 7.071 7.071l1.414-1.414 1.415 1.414Zm-.708-10.607 1.415 1.414-7.071 7.072-1.415-1.415 7.071-7.07Z" />
          </svg>
        </ToolbarButton>

        {linkPopoverOpen ? (
          <div className={linkPopoverShell}>
            <label htmlFor="editor-link-input" className={linkLabel}>
              Link URL
            </label>
            <input
              id="editor-link-input"
              ref={inputRef}
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveLink();
                }
                if (e.key === "Escape") {
                  setLinkPopoverOpen(false);
                }
              }}
              placeholder="https://example.com"
              className={linkInputClass}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={removeLink} className={linkGhostBtn}>
                Remove
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setLinkPopoverOpen(false)} className={linkGhostBtn}>
                  Cancel
                </button>
                <button type="button" onClick={saveLink} className={linkApplyBtn}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="px-3 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
