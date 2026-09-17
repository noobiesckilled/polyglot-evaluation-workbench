import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

public final class Worker {
    public static int[][] parse(String line) {
        String[] parts = line.trim().split("\\s+");
        int count = Integer.parseInt(parts[0]);
        if (count < 0 || count > 128 || parts.length != 1 + 2 * count) {
            throw new IllegalArgumentException("Invalid interval count");
        }
        int[][] values = new int[count][2];
        for (int i = 0; i < count; i++) {
            int a = Integer.parseInt(parts[1 + 2 * i]);
            int b = Integer.parseInt(parts[2 + 2 * i]);
            if (a > b || a < -1000000 || b > 1000000) {
                throw new IllegalArgumentException("Invalid interval");
            }
            values[i] = new int[] {a, b};
        }
        return values;
    }

    public static int[][] merge(int[][] input) {
        int[][] sorted = Arrays.stream(input).map(int[]::clone).toArray(int[][]::new);
        Arrays.sort(sorted, Comparator.comparingInt((int[] a) -> a[0]).thenComparingInt(a -> a[1]));
        List<int[]> result = new ArrayList<>();
        for (int[] interval : sorted) {
            if (!result.isEmpty() && interval[0] <= result.get(result.size() - 1)[1]) {
                int[] last = result.get(result.size() - 1);
                last[1] = Math.max(last[1], interval[1]);
            } else result.add(interval);
        }
        return result.toArray(int[][]::new);
    }

    public static void main(String[] args) throws Exception {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = reader.readLine()) != null;) {
                System.out.println(Arrays.deepToString(merge(parse(line))));
            }
        }
    }
}
