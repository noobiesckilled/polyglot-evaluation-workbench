export default function Status({ value }: { value: string }) {
  return <span className={`status ${value}`}>{value.replace("-", " ")}</span>;
}
