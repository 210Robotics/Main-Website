"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  sendUniversityVerificationCode,
  verifyUniversityEmailCode,
} from "@/app/verify/actions";

export function UtsaEmailVerification() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@my.utsa.edu")) {
      setError("Enter your official @my.utsa.edu email address.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await sendUniversityVerificationCode(normalizedEmail);
      if (result.status === "error") throw new Error(result.message);
      setCodeSent(!result.verified);
      setMessage(result.message);
      if (result.verified) router.refresh();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "The verification email could not be sent.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (!codeSent) {
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
      const result = await verifyUniversityEmailCode(code.trim());
      if (result.status === "error") throw new Error(result.message);
      setMessage(result.message);
      router.refresh();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "The verification code was not accepted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold">Verify your UTSA email</h2>
      <p className="mt-3 text-sm leading-6 text-[#aaa]">
        We send a one-time code to your official student inbox. Your Clerk
        identity is marked verified only after you enter the correct code.
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
          disabled={pending}
        />
      </label>
      <button
        className="button secondary mt-3 w-full justify-center"
        type="button"
        onClick={sendCode}
        disabled={pending}
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
