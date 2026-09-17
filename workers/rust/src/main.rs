use std::io::{self, BufRead};

fn merge(input: &[[i32; 2]]) -> Vec<[i32; 2]> {
    let mut values = input.to_vec();
    values.sort_unstable();
    let mut result: Vec<[i32; 2]> = Vec::new();
    for pair in values {
        if let Some(last) = result.last_mut() {
            if pair[0] <= last[1] {
                last[1] = last[1].max(pair[1]);
                continue;
            }
        }
        result.push(pair);
    }
    result
}

fn parse(line: &str) -> Result<Vec<[i32; 2]>, &'static str> {
    let values: Vec<i32> = line
        .split_whitespace()
        .map(str::parse)
        .collect::<Result<_, _>>()
        .map_err(|_| "invalid integer")?;
    let count = *values.first().ok_or("missing count")?;
    if !(0..=128).contains(&count) || values.len() != 1 + count as usize * 2 {
        return Err("invalid count");
    }
    let mut pairs = Vec::new();
    for pair in values[1..].chunks_exact(2) {
        if pair[0] > pair[1] || pair[0] < -1_000_000 || pair[1] > 1_000_000 {
            return Err("invalid interval");
        }
        pairs.push([pair[0], pair[1]]);
    }
    Ok(pairs)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    for line in io::stdin().lock().lines() {
        let result = merge(&parse(&line?)?);
        let body: Vec<String> = result
            .iter()
            .map(|p| format!("[{},{}]", p[0], p[1]))
            .collect();
        println!("[{}]", body.join(","));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn merges_touching_without_mutating_input() {
        let input = [[3, 5], [1, 3], [9, 9]];
        assert_eq!(merge(&input), vec![[1, 5], [9, 9]]);
        assert_eq!(input[0], [3, 5]);
        assert!(merge(&[]).is_empty());
    }
    #[test]
    fn rejects_invalid_input() {
        for value in ["", "-1", "2 1 3", "1 5 1", "1 -1000001 0", "1 x 5"] {
            assert!(parse(value).is_err());
        }
    }
}
