import Base

# Elvenar — Y-sort predicate (Bend spec, canvas runtime).
# Painter's order: draw a before b iff a.y <= b.y, so sprites lower on screen
# overlap ones above. Routed through a param-bound picker because match cannot
# scrutinize the computed Nat.cmp (see Lottery.bend min_pick pattern).
# TS canvas (components/road/CampusCanvas.tsx) is authoritative.

def y_sort_pick(c: Cmp, +a: Bool, +b: Bool) -> Bool:
  match c:
    case LT{}:
      a
    case EQ{}:
      a
    case GT{}:
      b

def y_sort(a: Nat, b: Nat) -> Bool:
  y_sort_pick(Nat.cmp(a, b), True{}, False{})

def render_order() -> String:
  "Elvenar — HTML5 Canvas, Y-sorted sprites, one engine for web+iOS+Android"

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print(render_order())
