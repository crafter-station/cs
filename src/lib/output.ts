import * as p from "@clack/prompts"
import pc from "picocolors"

export interface OutputContext {
  info(msg: string): void
  success(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  intro(msg: string): void
  outro(msg: string): void
  spinner(): { start(msg: string): void; stop(msg: string): void }
  result<T>(data: T): void
}

interface JsonResult {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

function createHumanOutput(): OutputContext {
  return {
    info: (msg) => p.log.info(msg),
    success: (msg) => p.log.success(msg),
    warn: (msg) => p.log.warning(msg),
    error: (msg) => p.log.error(msg),
    intro: (msg) => p.intro(msg),
    outro: (msg) => p.outro(msg),
    spinner: () => p.spinner(),
    result: () => {},
  }
}

function createJsonOutput(): OutputContext {
  let resultData: unknown = null

  const noop = () => {}

  return {
    info: noop,
    success: noop,
    warn: noop,
    error: noop,
    intro: noop,
    outro: noop,
    spinner: () => ({ start: noop, stop: noop }),
    result: <T>(data: T) => {
      resultData = data
      const output: JsonResult = { ok: true, data }
      console.log(JSON.stringify(output))
    },
  }
}

export function outputError(json: boolean, code: string, message: string) {
  if (json) {
    const output: JsonResult = { ok: false, error: { code, message } }
    console.log(JSON.stringify(output))
  } else {
    p.log.error(pc.red(message))
  }
}

export function createOutput(opts: { json?: boolean }): OutputContext {
  const isJson = opts.json || !process.stdout.isTTY
  return isJson ? createJsonOutput() : createHumanOutput()
}
