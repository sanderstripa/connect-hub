# Compatible Sudoku Core source and notices

The core is built from checksum-pinned original Sudoku source plus the disclosed
patches below. The compatible core-v0.7.1 client from sanderstripa/sudoku-ui,
release built from upstream v0.5.2-1, remains an interoperability
test reference. Original Sudoku by saba and
contributors: https://github.com/SUDOKU-ASCII/sudoku, GPL-3.0-or-later with the
original naming/association notice retained in SUDOKU-LICENSE. Compatibility
modifications by Sander Stripa and contributors are in sudoku-access-control.patch.
The additional Connect Hub sudoku-native-listen.patch adds an optional local
listen address matching the standard inbound field. It does not change the wire
protocol. Registered device hashes form an exact whitelist in the server config.
Connect Hub is independent; no endorsement by the original Sudoku authors is implied.

Each native package includes SUDOKU-original-source.tar.gz at original revision
b1d1f0e767653d2c70e2ff814a01264c7dedf1f4, its LICENSE, and both patches. To rebuild
the compatible core on Linux, use Go 1.27.3 and its source go.mod/go.sum:

```bash
tar -xzf SUDOKU-original-source.tar.gz
cd sudoku-b1d1f0e767653d2c70e2ff814a01264c7dedf1f4
git apply ../hub/third-party/sudoku-access-control.patch
git apply ../hub/third-party/sudoku-native-listen.patch
go test ./internal/access ./internal/app ./internal/tunnel
CGO_ENABLED=0 go build -trimpath -ldflags '-s -w' -o sudoku ./cmd/sudoku-tunnel
```

The URL, source/archive digests and patch revision are recorded in
hub/dependencies.json and BUILD.json. The source and patch accompany the binary;
the above recipe mirrors hub/build-sudoku.py. Native binary
byte reproducibility has not been asserted. No code from existing personal
Sudoku installations is read or copied.
