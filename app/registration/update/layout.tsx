import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Update registration",
  description:
    "Review and update your East African Magistrates' and Judges' Association conference registration, including your profile photo.",
  robots: { index: false },
};

export default function UpdateRegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
