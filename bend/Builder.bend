import Base

# Builder — parallel build pipeline: api | chain | ui
# Each target chooses its language; Bend compiles to that target.
# api   -> JS (Vercel, bend -o api.js)
# chain -> Rust/C (proof engine, bend -o chain.c)
# ui    -> JS (Next.js, bend -o ui.js)
# Demonstrates Bend's parallel evaluation + language selection.

def lang_chain(b: Bool) -> String:
  match b:
    case True{}:
      "Rust/C (proof, bend -o chain.c -> rustc/cc)"
    case False{}:
      "JS (Next.js, bend -o ui.js)"

def lang_api(b: Bool, +target: String) -> String:
  match b:
    case True{}:
      "JS (Vercel, bend -o api.js)"
    case False{}:
      lang_chain(String.eq(target, "chain"))

def lang_of(+target: String) -> String:
  lang_api(String.eq(target, "api"), target)

def build_api() -> IO(String):
  IO.pure(String, String.append("api   -> ", lang_of("api")))

def build_chain() -> IO(String):
  IO.pure(String, String.append("chain -> ", lang_of("chain")))

def build_ui() -> IO(String):
  IO.pure(String, String.append("ui    -> ", lang_of("ui")))

def format_plan(a: String, c: String, u: String) -> String:
  String.append("[Builder] parallel plan (3 targets, fork/join):\n  ",
    String.append(a,
      String.append("\n  ",
        String.append(c,
          String.append("\n  ", u)))))

def main() -> IO(Unit):
  IO.bind(Chan(String), Unit, IO.fork(String, build_api()), a_chan =>
    IO.bind(Chan(String), Unit, IO.fork(String, build_chain()), c_chan =>
      IO.bind(Chan(String), Unit, IO.fork(String, build_ui()), u_chan =>
        IO.bind(String, Unit, IO.join(String, a_chan), a =>
          IO.bind(String, Unit, IO.join(String, c_chan), c =>
            IO.bind(String, Unit, IO.join(String, u_chan), u =>
              IO.print(format_plan(a, c, u))
            )
          )
        )
      )
    )
  )
