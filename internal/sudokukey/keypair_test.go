package sudokukey

import "testing"

func TestDistinctDeviceKeysBelongToSameServer(t *testing.T) {
	pair, err := GenerateMasterKey()
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for range 8 {
		key, err := SplitPrivateKey(pair.Private)
		if err != nil {
			t.Fatal(err)
		}
		if len(key) != 128 || seen[key] {
			t.Fatal("device key is invalid or duplicated")
		}
		seen[key] = true
		pub, err := RecoverPublicKey(key)
		if err != nil || EncodePoint(pub) != EncodePoint(pair.Public) {
			t.Fatal("device key does not match the server identity")
		}
	}
}

func TestMalformedKeyCannotBecomeAClientIdentity(t *testing.T) {
	for _, value := range []string{"", "not-hex", "00", "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"} {
		if _, err := ParsePrivateScalar(value); err == nil {
			t.Fatalf("accepted malformed key %q", value)
		}
	}
}
