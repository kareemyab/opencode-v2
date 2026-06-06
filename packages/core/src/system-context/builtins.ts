export * as SystemContextBuiltIns from "./builtins"

import { DateTime, Effect, Layer, Schema } from "effect"
import { Location } from "../location"
import { SystemContext } from "./index"
import { InstructionContext } from "../instruction-context"
import { SystemContextRegistry } from "./registry"

const mermaid = [
  "When using Mermaid diagrams to explain architecture, flows, or relationships:",
  "- Diagrams render on a dark/black background in the UI",
  "- Write diagram code for dark backgrounds: use light text, light borders, and light or medium node fills with dark text",
  "- Do not add `%%{init:...}%%` blocks that switch to light themes or white backgrounds",
  "- Use fenced code blocks with the `mermaid` language tag",
].join("\n")

const builtIns = Layer.effectDiscard(
  Effect.gen(function* () {
    const location = yield* Location.Service
    const registry = yield* SystemContextRegistry.Service
    const environment = [
      "<env>",
      `  Working directory: ${location.directory}`,
      `  Workspace root folder: ${location.project.directory}`,
      `  Is directory a git repo: ${location.vcs?.type === "git" ? "yes" : "no"}`,
      `  Platform: ${process.platform}`,
      "</env>",
    ].join("\n")
    const context = SystemContext.combine([
      SystemContext.make({
        key: SystemContext.Key.make("core/environment"),
        codec: Schema.toCodecJson(Schema.String),
        load: Effect.succeed(environment),
        baseline: (environment) =>
          ["Here is some useful information about the environment you are running in:", environment].join("\n"),
        update: (_previous, environment) => ["The environment you are running in is now:", environment].join("\n"),
      }),
      SystemContext.make({
        key: SystemContext.Key.make("core/date"),
        codec: Schema.toCodecJson(Schema.String),
        load: DateTime.nowAsDate.pipe(Effect.map((date) => date.toDateString())),
        baseline: (date) => `Today's date: ${date}`,
        update: (_previous, date) => `Today's date is now: ${date}`,
      }),
      SystemContext.make({
        key: SystemContext.Key.make("core/mermaid"),
        codec: Schema.toCodecJson(Schema.String),
        load: Effect.succeed(mermaid),
        baseline: (text) => text,
        update: (_previous, text) => text,
      }),
    ])

    yield* registry.contribute({ key: SystemContext.Key.make("core/builtins"), load: Effect.succeed(context) })
  }),
)

export const layer = Layer.mergeAll(builtIns, InstructionContext.layer).pipe(
  Layer.provideMerge(SystemContextRegistry.layer),
)

export const locationLayer = layer
