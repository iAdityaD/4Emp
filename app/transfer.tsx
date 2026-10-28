import { Redirect } from "expo-router";
export default function TransferAlias() {
  return (
    <Redirect
      href={{ pathname: "/quick-entry", params: { type: "TRANSFER" } }}
    />
  );
}
