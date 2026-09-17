package main

import (
	"reflect"
	"testing"
)

func TestMerge(t *testing.T) {
	input := [][2]int{{3, 5}, {1, 3}, {9, 9}}
	if got := merge(input); !reflect.DeepEqual(got, [][2]int{{1, 5}, {9, 9}}) {
		t.Fatalf("unexpected result: %v", got)
	}
	if input[0][0] != 3 {
		t.Fatal("input mutated")
	}
	if got := merge(nil); got == nil || len(got) != 0 {
		t.Fatal("empty result must serialize to []")
	}
}

func TestInvalidInput(t *testing.T) {
	for _, value := range []string{"", "-1", "2 1 3", "1 5 1", "1 -1000001 0", "1 x 5"} {
		if _, err := parse(value); err == nil {
			t.Fatalf("accepted %q", value)
		}
	}
}
