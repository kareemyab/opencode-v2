import { createMemo, Show } from "solid-js"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { SessionTodoList } from "@/pages/session/composer/session-todo-dock"
import { useSessionLayout } from "@/pages/session/session-layout"

export function SessionTaskTab() {
  const language = useLanguage()
  const serverSync = useServerSync()
  const { params } = useSessionLayout()

  const todos = createMemo(() => {
    const id = params.id
    if (!id) return []
    return serverSync.data.session_todo[id] ?? []
  })

  const total = createMemo(() => todos().length)
  const done = createMemo(() => todos().filter((todo) => todo.status === "completed").length)

  return (
    <ScrollView class="h-full">
      <div class="px-4 py-3 flex flex-col gap-4">
        <Show
          when={total() > 0}
          fallback={<div class="text-12-regular text-text-weak">{language.t("session.task.empty")}</div>}
        >
          <div class="text-12-regular text-text-weak">
            {language.t("session.todo.progress", { done: done(), total: total() })}
          </div>
          <SessionTodoList todos={todos()} />
        </Show>
      </div>
    </ScrollView>
  )
}
