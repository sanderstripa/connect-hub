// Connect Hub native Sudoku runtime support. GPL-3.0.
package hub

// SudokuBinary verifies the bundled core before a native inbound starts it.
func SudokuBinary() (string, error) { return binary() }

// SudokuEnvironment gives every managed inbound its own control socket, policy
// and counters, without inheriting another installation's control paths.
func SudokuEnvironment(dir string) []string { return environmentAt(dir) }
