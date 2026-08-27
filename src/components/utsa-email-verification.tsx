"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { refreshUniversityVerification } from "@/app/verify/actions";

type VerificationAddress = {
  id: string;
  emailAddress: string;
  verification: { status: string | null };
  prepareVerification: (params: { strategy: "email_code" }) => Promise<unknown>;
  attemptVerification: (params: { code: string }) => Promise<{
    verification: { status: string | null };
  }>;
};

function clerkErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const first = error.errors[0] as { longMessage?: string; message?: string };
    return first?.longMessage || first?.message || "Clerk could not verify that email.";
  }
  return error instanceof Error
    ? error.message
    : "Clerk could not verify that email.";
}

export function UtsaEmailVerification() {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const verificationAddress = useRef<VerificationAddress | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendCode() {
    if (!user) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@my.utsa.edu")) {
      setError("Enter your official @my.utsa.edu email address.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      let address = user.emailAddresses.find(
        (candidate) => candidate.emailAddress.toLowerCase() === normalizedEmail,
      ) as VerificationAddress | undefined;
      if (!address) {
        address = (await user.createEmailAddress({
          email: normalizedEmail,
        })) as VerificationAddress;
      }
      if (address.verification.status === "verified") {
        await refreshUniversityVerification();
        router.refresh();
        setMessage("Your UTSA email is already verified through Clerk.");
        return;
      }
      await address.prepareVerification({ strategy: "email_code" });
      verificationAddress.current = address;
      setCodeSent(true);
      setMessage(`Clerk sent a verification code to ${normalizedEmail}.`);
    } catch (verificationError) {
      setError(clerkErrorMessage(verificationError));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    const address = verificationAddress.current;
    if (!address || !user) {
      setError("Send a new verification code first.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the six-digit code from your UTSA email.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await address.attemptVerification({ code: code.trim() });
      if (result.verification.status !== "verified") {
        throw new Error("The verification code was not accepted.");
      }
      await user.reload();
      await refreshUniversityVerification();
      setMessage("UTSA email verified. Your membership access is being synchronized.");
      router.refresh();
    } catch (verificationError) {
      setError(clerkErrorMessage(verificationError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold">Verify your UTSA email</h2>
      <p className="mt-3 text-sm leading-6 text-[#aaa]">
        Clerk sends a one-time code to your official student inbox. Entering an
        address alone never grants access.
      </p>
      <label className="field mt-5">
        <span>UTSA student email</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder="abc123@my.utsa.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!isLoaded || pending}
        />
      </label>
      <button
        className="button secondary mt-3 w-full justify-center"
        type="button"
        onClick={sendCode}
        disabled={!isLoaded || !user || pending}
      >
        {pending && !codeSent ? "Sending…" : "Send verification code"}
      </button>
      {codeSent ? (
        <div className="mt-5 grid gap-3 border-t border-[#333] pt-5">
          <label className="field">
            <span>Six-digit verification code</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </label>
          <button
            className="button w-full justify-center"
            type="button"
            onClick={verifyCode}
            disabled={pending || code.length !== 6}
          >
            {pending ? "Verifying…" : "Verify and continue"}
          </button>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-4 text-sm text-emerald-300">
        {message}
      </p>
      <p aria-live="assertive" className="mt-2 text-sm text-red-300">
        {error}
      </p>
    </div>
  );
}
