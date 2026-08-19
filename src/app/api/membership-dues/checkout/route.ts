import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { membershipDues, membershipDuesPayments } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { currentMembershipPeriod } from "@/lib/membership-dues";
import { getStripe, stripeIsConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

const inputSchema = z.object({ duesId: z.string().uuid() });

export async function POST(request: Request) {
  const member = await requireActiveMember();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: "Choose a valid membership-dues record." },
      { status: 400 },
    );
  }
  if (!stripeIsConfigured()) {
    return Response.json(
      { message: "Card payments are temporarily unavailable." },
      { status: 503 },
    );
  }
  const [dues] = await getDb()
    .select()
    .from(membershipDues)
    .where(
      and(
        eq(membershipDues.id, parsed.data.duesId),
        eq(membershipDues.memberId, member.id),
        eq(membershipDues.period, currentMembershipPeriod()),
      ),
    )
    .limit(1);
  if (!dues) {
    return Response.json(
      { message: "No current membership-dues balance was found." },
      { status: 404 },
    );
  }
  if (dues.status === "WAIVED" || dues.status === "PAID") {
    return Response.json(
      { message: "These membership dues are already settled." },
      { status: 409 },
    );
  }
  const outstandingCents = Math.max(
    0,
    dues.amountDueCents - dues.amountPaidCents,
  );
  if (outstandingCents < 50) {
    return Response.json(
      { message: "There is no payable balance on this record." },
      { status: 409 },
    );
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      customer_email: member.email,
      client_reference_id: member.id,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: outstandingCents,
            product_data: {
              name: `210 Robotics membership dues — ${dues.period}`,
              description: `Membership dues for ${member.displayName}`,
            },
          },
        },
      ],
      custom_text: {
        submit: {
          message:
            "Discord access updates automatically after Stripe confirms the payment.",
        },
      },
      metadata: {
        purpose: "membership_dues",
        membershipDuesId: dues.id,
        memberId: member.id,
        period: dues.period,
      },
      payment_intent_data: {
        metadata: {
          purpose: "membership_dues",
          membershipDuesId: dues.id,
          memberId: member.id,
          period: dues.period,
        },
      },
    });
    if (!session.client_secret) {
      return Response.json(
        { message: "Stripe did not return a secure payment form." },
        { status: 502 },
      );
    }
    await getDb()
      .insert(membershipDuesPayments)
      .values({
        membershipDuesId: dues.id,
        memberId: member.id,
        stripeCheckoutSessionId: session.id,
        amountCents: outstandingCents,
        currency: session.currency ?? "usd",
        status: "PENDING",
      })
      .onConflictDoNothing({
        target: membershipDuesPayments.stripeCheckoutSessionId,
      });
    return Response.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Membership dues checkout could not be created", {
      memberId: member.id,
      duesId: dues.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { message: "Secure payment could not be opened. Please try again shortly." },
      { status: 503 },
    );
  }
}

