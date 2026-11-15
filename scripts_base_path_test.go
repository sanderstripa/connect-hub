package main

import (
    "os"
    "os/exec"
    "strings"
    "testing"
)

// Connect Hub no longer ships the upstream monolithic install/update scripts.
// They are a verified release bootstrap and an owned-install updater.
// Test the scripts that are actually invoked, rather than sourcing removed
// gen_random_string/config_after_update functions from the former installer.
func scriptSource(t *testing.T, name string) string {
    t.Helper()
    data, err := os.ReadFile(name)
    if err != nil { t.Fatal(err) }
    return string(data)
}

func assertScriptContains(t *testing.T, script string, tokens ...string) {
    t.Helper()
    for _, token := range tokens {
        if !strings.Contains(script, token) {
            t.Errorf("installer contract missing %q", token)
        }
    }
}

func TestBootstrapAndUpdateScriptsHaveValidBashSyntax(t *testing.T) {
    if _, err := exec.LookPath("bash"); err != nil { t.Skip("bash unavailable") }
    for _, name := range []string{"install.sh", "update.sh", "hub/install.sh", "hub/update.sh"} {
        t.Run(name, func(t *testing.T) {
            result := exec.Command("bash", "-n", name)
            if out, err := result.CombinedOutput(); err != nil {
                t.Fatalf("invalid %s syntax: %v\n%s", name, err, out)
            }
        })
    }
}

func TestVerifiedReleaseBootstrapGuardsExistingInstallations(t *testing.T) {
    bootstrap := scriptSource(t, "install.sh")
    assertScriptContains(t, bootstrap,
        "sha256sum --check --status",
        "connect-hub-linux-amd64.tar.gz",
        "hub/install.sh",
        "--sha256",
        "--update",
        "github.com/sanderstripa/connect-hub/releases",
    )
    // The bootstrap must never directly write an old panel's settings:
    // its only write path is a fully verified package passed to the owned installer.
    if strings.Contains(bootstrap, "setting -webBasePath") || strings.Contains(bootstrap, "gen_random_string") {
        t.Fatal("the public bootstrap must not initialize or reset existing panel settings")
    }
}

func TestManagedUpdatePreservesDataAndRollsBackOnFailure(t *testing.T) {
    rootUpdate := scriptSource(t, "update.sh")
    assertScriptContains(t, rootUpdate, `exec bash "$script_dir/hub/update.sh" "$@"`)
    update := scriptSource(t, "hub/update.sh")
    assertScriptContains(t, update,
        ".connect-hub-owned",
        "sha256sum --check --status",
        "--update",
        "hub/install.sh",
    )
    managed := scriptSource(t, "hub/install.sh")
    assertScriptContains(t, managed,
        `[[ -L $prefix/current && -f $data/.connect-hub-owned ]]`,
        `cp -a "$data" "$backup/data"`,
        `mv "$data" "$backup/failed-data"`,
        `cp -a "$backup/data" "$data"`,
        `ln -s "$old" "$prefix/current.rollback"`,
        `panel_path=$(printf`,
        `if ((!update && service));then`,
        `elif ((!update));then`,
    )
    // Only a fresh installation initializes the base path and password;
    // in-place updates reread the installed settings rather than replacing them.
    startFresh := strings.Index(managed, "if ((!update && service));then")
    startExisting := strings.Index(managed, "elif ((!update));then")
    if startFresh < 0 || startExisting < startFresh { t.Fatal("fresh/install branch guards missing") }
    if strings.Contains(managed[:startFresh], "setting -username") { t.Fatal("setup writes credentials outside a fresh-only branch") }
}
