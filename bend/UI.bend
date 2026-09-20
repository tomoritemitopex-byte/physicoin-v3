import Base

def hello(name: String) -> String:
  String.append("Hello, ", name)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print(hello("Physicoin — UI as parallel data, every slip at once"))
