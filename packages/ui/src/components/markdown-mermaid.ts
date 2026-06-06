export function normalizeMermaidSource(source: string) {
  return source.replace(/^(\s*)([A-Za-z]\w*)\[([^\]"\n]+)\]/gm, (match, indent, id, label) => {
    if (!/[()]/.test(label)) return match
    const escaped = label.replace(/"/g, "#quot;")
    return `${indent}${id}["${escaped}"]`
  })
}
