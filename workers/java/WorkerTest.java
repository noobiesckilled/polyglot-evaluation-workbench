import java.util.Arrays;

public final class WorkerTest {
    public static void main(String[] args) {
        int[][] input = {{3, 5}, {1, 3}, {9, 9}};
        if (!Arrays.deepEquals(Worker.merge(input), new int[][]{{1, 5}, {9, 9}})) throw new AssertionError("Touching merge failed");
        if (input[0][0] != 3) throw new AssertionError("Input mutated");
        if (Worker.merge(new int[0][2]).length != 0) throw new AssertionError("Empty input failed");
        for (String bad : new String[]{"-1", "2 1 3", "1 5 1", "1 -1000001 0"}) {
            try { Worker.parse(bad); throw new AssertionError("Accepted invalid input"); }
            catch (IllegalArgumentException expected) { }
        }
        System.out.println("Java worker tests passed");
    }
}
