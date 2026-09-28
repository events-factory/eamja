import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accommodation",
  description:
    "Book a partner hotel for the East African Magistrates' and Judges' Association conference at the negotiated event rate.",
};

export default function AccommodationTwoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
