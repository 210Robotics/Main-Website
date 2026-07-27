import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { donations, members } from "@/db/schema";
import { getDonationCampaign } from "@/lib/donations";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const inputSchema = z.object({
  amount: z.number().finite().min(1).max(50_000),
  attributedMemberId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: "Choose an amount from $1 to $50,000." },
      { status: 400 },
    );
  }
  const amountCents = Math.round(parsed.data.amount * 100);
  try {
    const campaign = await getDonationCampaign();
    if (!campaign.isActive) {
      return Response.json(
        { message: "Online donations are temporarily paused." },
        { status: 503 },
      );
    }
    const attributedMemberId = parsed.data.attributedMemberId || null;
    if (attributedMemberId) {
      const [activeMember] = await getDb()
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.id, attributedMemberId),
            eq(members.status, "ACTIVE"),
            eq(members.isPublic, true),
          ),
        )
        .limit(1);
      if (!activeMember) {
        return Response.json(
          { message: "That team member is no longer available for attribution." },
          { status: 400 },
        );
      }
    }
    const club210 = amountCents >= 21_000;
    const customFields: Stripe.Checkout.SessionCreateParams.CustomField[] = [
      {
        key: "donor_name",
        label: { type: "custom", custom: "Public recognition name (optional)" },
        type: "text",
        optional: true,
      },
      {
        key: "donor_message",
        label: { type: "custom", custom: "Message to the team (optional)" },
        type: "text",
        optional: true,
      },
    ];
    if (club210) {
      customFields.push({
        key: "shirt_size",
        label: { type: "custom", custom: "Club 210 T-shirt size" },
        type: "dropdown",
        optional: false,
        dropdown: {
          options: ["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((size) => ({
            label: size,
            value: size,
          })),
        },
      });
    }
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      submit_type: "donate",
      customer_creation: "always",
      billing_address_collection: "auto",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Donation to 210 Robotics",
              description: campaign.title,
            },
          },
        },
      ],
      custom_fields: customFields,
      custom_text: club210
        ? {
            submit: {
              message:
                "Club 210 includes a team T-shirt, competition invitations (travel and lodging are not provided), and optional website recognition.",
            },
          }
        : undefined,
      metadata: {
        purpose: "donation",
        campaignId: campaign.id,
        club210: String(club210),
        attributedMemberId: attributedMemberId || "",
      },
      payment_intent_data: {
        metadata: {
          purpose: "donation",
          campaignId: campaign.id,
          attributedMemberId: attributedMemberId || "",
        },
      },
    });
    if (!session.client_secret) {
      return Response.json(
        { message: "Stripe did not return a payment form." },
        { status: 502 },
      );
    }
    await getDb()
      .insert(donations)
      .values({
        campaignId: campaign.id,
        stripeCheckoutSessionId: session.id,
        amountCents,
        currency: session.currency ?? "usd",
        status: "PENDING",
        attributedMemberId,
      })
      .onConflictDoNothing({ target: donations.stripeCheckoutSessionId });
    return Response.json({ clientSecret: session.client_secret });
  } catch {
    return Response.json(
      { message: "Secure payment could not be opened. Please try again shortly." },
      { status: 503 },
    );
  }
}
