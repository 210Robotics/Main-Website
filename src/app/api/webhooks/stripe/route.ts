import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { donations } from "@/db/schema";
import {
  DEFAULT_DONATION_CAMPAIGN,
  syncDonationIncomeEntry,
} from "@/lib/donations";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function customValue(session: Stripe.Checkout.Session, key: string) {
  const field = session.custom_fields?.find((item) => item.key === key);
  if (field?.type === "text") return field.text?.value?.trim() || null;
  if (field?.type === "dropdown") return field.dropdown?.value?.trim() || null;
  if (field?.type === "numeric") return field.numeric?.value?.trim() || null;
  return null;
}

async function recordCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.purpose !== "donation") return;
  const campaignId =
    session.metadata.campaignId || DEFAULT_DONATION_CAMPAIGN.id;
  const paymentIntentId = objectId(session.payment_intent);
  const paid = session.payment_status === "paid";
  const values = {
    campaignId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status: paid ? "PAID" : "PROCESSING",
    donorName: customValue(session, "donor_name"),
    donorEmail: session.customer_details?.email || null,
    donorMessage: customValue(session, "donor_message"),
    attributedMemberId: session.metadata?.attributedMemberId || null,
    club210ShirtSize: customValue(session, "shirt_size"),
    paidAt: paid ? new Date() : null,
    updatedAt: new Date(),
  };
  const [donation] = await getDb()
    .insert(donations)
    .values(values)
    .onConflictDoUpdate({
      target: donations.stripeCheckoutSessionId,
      set: {
        stripePaymentIntentId: values.stripePaymentIntentId,
        amountCents: values.amountCents,
        currency: values.currency,
        status: values.status,
        donorName: values.donorName,
        donorEmail: values.donorEmail,
        donorMessage: values.donorMessage,
        attributedMemberId: values.attributedMemberId,
        club210ShirtSize: values.club210ShirtSize,
        paidAt: values.paidAt,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  if (donation) await syncDonationIncomeEntry(donation);
}

async function expireCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.purpose !== "donation") return;
  await getDb()
    .update(donations)
    .set({ status: "EXPIRED", updatedAt: new Date() })
    .where(eq(donations.stripeCheckoutSessionId, session.id));
}

async function failCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.purpose !== "donation") return;
  await getDb()
    .update(donations)
    .set({ status: "FAILED", updatedAt: new Date() })
    .where(eq(donations.stripeCheckoutSessionId, session.id));
}

async function recordRefund(charge: Stripe.Charge) {
  const paymentIntentId = objectId(charge.payment_intent);
  if (!paymentIntentId) return;
  const fullyRefunded = charge.amount_refunded >= charge.amount;
  const [donation] = await getDb()
    .update(donations)
    .set({
      refundedCents: charge.amount_refunded,
      status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      updatedAt: new Date(),
    })
    .where(eq(donations.stripePaymentIntentId, paymentIntentId))
    .returning();
  if (donation) await syncDonationIncomeEntry(donation);
}

async function recordDispute(dispute: Stripe.Dispute) {
  const paymentIntentId = objectId(dispute.payment_intent);
  if (!paymentIntentId) return;
  const status = dispute.status === "won" ? "PAID" : "DISPUTED";
  const [donation] = await getDb()
    .update(donations)
    .set({ status, updatedAt: new Date() })
    .where(eq(donations.stripePaymentIntentId, paymentIntentId))
    .returning();
  if (donation) await syncDonationIncomeEntry(donation);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await recordCheckout(event.data.object);
        break;
      case "checkout.session.expired":
        await expireCheckout(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await failCheckout(event.data.object);
        break;
      case "charge.refunded":
        await recordRefund(event.data.object);
        break;
      case "charge.dispute.created":
      case "charge.dispute.closed":
        await recordDispute(event.data.object);
        break;
      default:
        break;
    }
    revalidatePath("/donate");
    revalidatePath("/sponsors");
    revalidatePath("/admin/operations");
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  }
}
