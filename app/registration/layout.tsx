import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description:
    "Register for the East African Magistrates' and Judges' Association conference. Choose your delegate category, complete your details and pay securely online.",
};

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
