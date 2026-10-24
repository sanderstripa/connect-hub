# Sudoku key generation

`internal/sudokukey/keypair.go` is the original
`pkg/crypto/keypair.go` from SUDOKU-ASCII/sudoku revision
`56ce6f1aeea18aa69b9bc1d57557ed312b59e5f5`, with only the Go package name
changed. The original copyright and GPL notices are retained in the file.
The exact `filippo.io/edwards25519 v1.2.0` dependency/checksums match that source.

This permits standard panel client creation without passing a server private
key in a helper process's command-line arguments. It does not change the
Sudoku wire protocol or invent a different key algorithm.
