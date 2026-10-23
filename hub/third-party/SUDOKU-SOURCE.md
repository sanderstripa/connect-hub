# Compatible Sudoku Core source and notices

The unmodified compatible binary is from sanderstripa/sudoku-ui core-v0.7.0,
commit a47140ffe8099392c4b14e23e7956f96fbf19dba. Original Sudoku by saba and
contributors: https://github.com/SUDOKU-ASCII/sudoku, GPL-3.0-or-later with the
original naming/association notice retained in SUDOKU-LICENSE. Compatibility
modifications by Sander Stripa and contributors are in sudoku-access-control.patch.
Connect Hub is independent; no endorsement by the original Sudoku authors is implied.

Each native package includes SUDOKU-original-source.tar.gz at original revision
56ce6f1aeea18aa69b9bc1d57557ed312b59e5f5, its LICENSE, and this patch. To rebuild
the compatible core on Linux, use Go 1.27.2 and its source go.mod/go.sum:

```bash
tar -xzf SUDOKU-original-source.tar.gz
cd sudoku-56ce6f1aeea18aa69b9bc1d57557ed312b59e5f5
git apply ../hub/third-party/sudoku-access-control.patch
go test ./internal/access ./internal/app ./internal/tunnel
CGO_ENABLED=0 go build -trimpath -ldflags '-s -w' -o sudoku ./cmd/sudoku-tunnel
```

The URL, source/archive digests and patch revision are recorded in
hub/dependencies.json and BUILD.json. The source and patch accompany the binary;
the above recipe mirrors the compatible release's build workflow. Native binary
byte reproducibility has not been asserted. No code from existing personal
Sudoku installations is read or copied.
