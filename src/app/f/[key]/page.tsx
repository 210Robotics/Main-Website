import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { publicFormResponses, publicForms } from "@/db/schema";
import { PublicForm } from "@/components/public-form";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "210 Robotics Form",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ response?: string }>;
}) {
  if (!hasDatabase()) notFound();
  const { key } = await params;
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(key)) notFound();
  const [form] = await getDb()
    .select()
    .from(publicForms)
    .where(eq(publicForms.accessKey, key))
    .limit(1);
  if (!form || form.status === "DRAFT") notFound();
  const member = await getCurrentMember();
  const activeMember = member?.status === "ACTIVE" ? member : null;
  const { response: responseId } = await searchParams;
  const [response] =
    activeMember && responseId && /^[0-9a-f-]{36}$/i.test(responseId)
      ? await getDb()
          .select()
          .from(publicFormResponses)
          .where(
            and(
              eq(publicFormResponses.id, responseId),
              eq(publicFormResponses.formId, form.id),
              eq(publicFormResponses.submittedByMemberId, activeMember.id),
            ),
          )
          .limit(1)
      : [];
  if (responseId && !response) notFound();
  return (
    <PublicForm
      form={{
        id: form.id,
        accessKey: form.accessKey,
        title: form.title,
        descriptionHtml: form.descriptionHtml,
        confirmationMessage: form.confirmationMessage,
        status: form.status,
        fields: form.fields,
      }}
      identity={
        activeMember
          ? { name: activeMember.displayName, email: activeMember.email }
          : null
      }
      initialResponse={
        response
          ? {
              id: response.id,
              answers: response.answers,
              respondentName: response.respondentName,
              respondentEmail: response.respondentEmail,
            }
          : null
      }
    />
  );
}
