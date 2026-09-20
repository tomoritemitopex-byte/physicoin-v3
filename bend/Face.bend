import Base

# Face — parallel UI generator (Bend spec, TS runtime).
# Each cell (hall name) is mapped to a styled slip representation in parallel
# (HVM/CUDA fork-join: `a b = f(head) face_cells(tail)`). Stub prefixes "◆ ".
# Bend is the parallel specification, verified via `bend --check-only
# bend/Face.bend` and executable via `bend run` for demos; TS remains the
# runtime. Build emits a runnable program (`bend build -o /tmp/face.js`),
# not an importable library — see bend/Face.js header.

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
