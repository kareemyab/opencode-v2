export function ToolSuccessIndicator() {
  return (
    <span data-slot="basic-tool-tool-indicator" data-variant="success" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle data-slot="tool-success-ring" cx="10" cy="10" r="6.25" />
        <path data-slot="tool-success-check" d="M7.35 10.05L9.15 11.85L12.75 8.25" />
      </svg>
    </span>
  )
}
