import { useMemo } from "react";

interface RichTextContentProps {
  content: string;
  className?: string;
}

const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;

function hasHtml(input: string) {
  return HTML_TAG_RE.test(input);
}

function sanitizeHtml(input: string) {
  if (typeof document === "undefined") return input;

  const template = document.createElement("template");
  template.innerHTML = input;

  const blockedTags = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"];
  for (const tag of blockedTags) {
    template.content.querySelectorAll(tag).forEach((el) => el.remove());
  }

  template.content.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && (value.startsWith("javascript:") || value.startsWith("data:text/html"))) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return template.innerHTML;
}

export function RichTextContent({ content, className }: RichTextContentProps) {
  const safeHtml = useMemo(() => sanitizeHtml(content), [content]);

  if (!hasHtml(content)) {
    return <p className={["whitespace-pre-wrap", className].filter(Boolean).join(" ")}>{content}</p>;
  }

  return (
    <div
      className={["prose prose-invert prose-sm max-w-none", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
