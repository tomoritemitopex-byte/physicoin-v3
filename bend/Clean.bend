import Base

# Clean — parallel cleanup plan: lists junk and marks for deletion
# Targets: .next, .cache, *.log, proof/target
# Each scanned in parallel (fork), then joined into a plan.

def clean_next() -> IO(String):
  IO.pure(String, ".next        -> rm -rf .next [MARKED]")

def clean_cache() -> IO(String):
  IO.pure(String, ".cache       -> rm -rf .cache [MARKED]")

def clean_logs() -> IO(String):
  IO.pure(String, "*.log        -> rm -f *.log [MARKED]")

def clean_proof() -> IO(String):
  IO.pure(String, "proof/target -> rm -rf proof/target [MARKED]")

def format_clean(a: String, b: String, c: String, d: String) -> String:
  String.append("[Clean] parallel cleanup plan (4 targets, fork/join):\n  ",
    String.append(a,
      String.append("\n  ",
        String.append(b,
          String.append("\n  ",
            String.append(c,
              String.append("\n  ", d)))))))

def main() -> IO(Unit):
  IO.bind(Chan(String), Unit, IO.fork(String, clean_next()), n_chan =>
    IO.bind(Chan(String), Unit, IO.fork(String, clean_cache()), c_chan =>
      IO.bind(Chan(String), Unit, IO.fork(String, clean_logs()), l_chan =>
        IO.bind(Chan(String), Unit, IO.fork(String, clean_proof()), p_chan =>
          IO.bind(String, Unit, IO.join(String, n_chan), n =>
            IO.bind(String, Unit, IO.join(String, c_chan), c =>
              IO.bind(String, Unit, IO.join(String, l_chan), l =>
                IO.bind(String, Unit, IO.join(String, p_chan), p =>
                  IO.print(format_clean(n, c, l, p))
                )
              )
            )
          )
        )
      )
    )
  )
