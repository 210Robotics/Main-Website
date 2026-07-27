import { redirect } from "next/navigation";

export default function ImpactIndex() {
  redirect(`/impact/${new Date().getFullYear()}`);
}
