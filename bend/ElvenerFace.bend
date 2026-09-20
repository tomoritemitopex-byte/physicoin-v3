import Base

# ElvenerFace — single-cell sprite demo (Bend spec, canvas runtime).
# One hall string ("ANAT — amber glow"); the real Y-sorted city lives in
# components/road/CampusCanvas.tsx with the predicate in Elvenar.bend.
# Verified via `bend --check-only`.

def anati_glow() -> String:
  "ANAT — amber glow"

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print(anati_glow())
