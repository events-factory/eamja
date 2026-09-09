import { redirect } from "next/navigation";

// Only the registration flow is built for now, so the root sends visitors
// straight to it.
export default function Home() {
  redirect("/registration");
}
