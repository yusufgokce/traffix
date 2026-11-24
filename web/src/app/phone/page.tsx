import type { Metadata, Viewport } from "next";
import PhoneApp from "@/components/phone/PhoneApp";

export const metadata: Metadata = { title: "Traffix - Driver" };
export const viewport: Viewport = { themeColor: "#101718", width: "device-width", initialScale: 1 };

export default function PhonePage() {
  return <PhoneApp />;
}
