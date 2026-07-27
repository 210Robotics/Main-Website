import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AutoCheckIn } from "@/components/auto-check-in";
import { getCurrentMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Attendance check-in", robots: { index: false, follow: false } };

export default async function AttendanceCheckInPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ method?: string }> }) {
  const { token } = await params;
  const { method } = await searchParams;
  const member = await getCurrentMember();
  const returnPath = `/attendance/check-in/${encodeURIComponent(token)}`;
  if (!member) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`);
  if (member.status !== "ACTIVE") redirect("/pending");
  return <section className="grid-bg min-h-[680px] py-20"><div className="shell"><AutoCheckIn token={token} method={method === "QR_CAMERA" ? "QR_CAMERA" : "QR_LINK"} /></div></section>;
}
