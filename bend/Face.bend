import Base

# Face — parallel UI generator: List<String> -> List<String> via Bend
# Each cell (hall name) is mapped to a styled slip representation in parallel
# (HVM/CUDA fork-join: `a b = f(head) face_cells(tail)`). Stub prefixes "◆ ".
# Build via `bend build bend/Face.bend -o /tmp/face.js` (mirrored to bend/Face.js)
# and import as `import { face_cells } from "@/bend/Face.js"` once emitted.
# Verifies with `bend --check-only bend/Face.bend`.
# Keep JS fallback in app/app/board/page.tsx until import is wired.

def face_cells(cells: List<String>) -> List<String>:
  match cells:
    case Nil{}:
      Nil{}
    case Con{head, tail}:
      # Parallel fork: transform head and tail concurrently via bend (HVM/CUDA)
      a b = String.append("◆ ", head) face_cells(tail)
      a <> b

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Face ready — face_cells: List<String> -> List<String> via parallel bend (◆ prefix stub)")
