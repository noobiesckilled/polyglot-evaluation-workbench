package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

func merge(input [][2]int) [][2]int {
	values := append([][2]int{}, input...)
	sort.Slice(values, func(i, j int) bool {
		if values[i][0] == values[j][0] {
			return values[i][1] < values[j][1]
		}
		return values[i][0] < values[j][0]
	})
	result := make([][2]int, 0)
	for _, pair := range values {
		if len(result) > 0 && pair[0] <= result[len(result)-1][1] {
			if pair[1] > result[len(result)-1][1] {
				result[len(result)-1][1] = pair[1]
			}
		} else {
			result = append(result, pair)
		}
	}
	return result
}

func parse(line string) ([][2]int, error) {
	parts := strings.Fields(line)
	if len(parts) == 0 {
		return nil, fmt.Errorf("missing count")
	}
	count, err := strconv.Atoi(parts[0])
	if err != nil || count < 0 || count > 128 || len(parts) != 1+2*count {
		return nil, fmt.Errorf("invalid count")
	}
	result := make([][2]int, 0, count)
	for i := 0; i < count; i++ {
		a, e1 := strconv.Atoi(parts[1+2*i])
		b, e2 := strconv.Atoi(parts[2+2*i])
		if e1 != nil || e2 != nil || a > b || a < -1000000 || b > 1000000 {
			return nil, fmt.Errorf("invalid interval")
		}
		result = append(result, [2]int{a, b})
	}
	return result, nil
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	encoder := json.NewEncoder(os.Stdout)
	for scanner.Scan() {
		values, err := parse(scanner.Text())
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if err := encoder.Encode(merge(values)); err != nil {
			os.Exit(1)
		}
	}
	if scanner.Err() != nil {
		os.Exit(1)
	}
}
