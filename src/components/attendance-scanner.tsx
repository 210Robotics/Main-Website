"use client";

import { Camera, CameraOff, ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AttendanceScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<null | (() => void)>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(
    "Point your camera at a 210 Robotics attendance QR code.",
  );
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  const handleAttendanceCode = useCallback(
    (value: string) => {
      try {
        const parsed = new URL(value, window.location.origin);
        const match = parsed.pathname.match(/^\/attendance\/check-in\/([^/]+)$/);
        if (!match) throw new Error("wrong code");
        stopRef.current?.();
        stopRef.current = null;
        setOpen(false);
        router.push(
          `/attendance/check-in/${encodeURIComponent(decodeURIComponent(match[1]))}?method=QR_CAMERA`,
        );
      } catch {
        setStatus("That is not a valid 210 Robotics attendance code.");
      }
    },
    [router],
  );

  useEffect(() => {
    if (!open) return;
    let canceled = false;

    async function beginCamera() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!video.current || canceled) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video.current,
          (result) => {
            if (result) handleAttendanceCode(result.getText());
          },
        );
        if (canceled) {
          controls.stop();
          return;
        }
        stopRef.current = () => controls.stop();
        setStatus("Camera ready. Hold the QR code inside the frame.");
      } catch (error) {
        console.error("Attendance camera failed", error);
        setStatus(
          "Camera access is unavailable. Allow camera access, scan a saved QR image below, or use your phone camera to open the QR link.",
        );
      } finally {
        if (!canceled) setStarting(false);
      }
    }

    void beginCamera();
    return () => {
      canceled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [handleAttendanceCode, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function scanSavedImage(file: File | undefined) {
    if (!file) return;
    setStatus("Reading saved QR image…");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      handleAttendanceCode(result.getText());
    } catch (error) {
      console.error("Saved attendance QR scan failed", error);
      setStatus("No readable attendance QR code was found in that image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function close() {
    stopRef.current?.();
    stopRef.current = null;
    setOpen(false);
  }

  function openScanner() {
    setStarting(true);
    setStatus("Starting camera…");
    setOpen(true);
  }

  return (
    <>
      <button className="button" type="button" onClick={openScanner}>
        <Camera size={17} /> Scan attendance QR
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-scanner-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="w-full max-w-[620px] border border-[#383838] bg-[#0b0b0b] p-5 text-white shadow-2xl md:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Attendance scanner</p>
                <h2 id="attendance-scanner-title" className="mt-2 text-2xl font-bold">
                  Scan to check in
                </h2>
              </div>
              <button className="calendar-control" onClick={close} aria-label="Close scanner">
                <X size={18} />
              </button>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden border border-[#383838] bg-black">
              <video ref={video} className="h-full w-full object-cover" muted playsInline />
              {starting && (
                <div className="absolute inset-0 grid place-items-center bg-black/65">
                  <CameraOff className="animate-pulse text-[#fd7803]" size={40} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-[14%] border-2 border-[#fd7803] shadow-[0_0_0_999px_rgba(0,0,0,.28)]" />
            </div>
            <p className="mt-4 text-sm leading-6 text-[#aaa]" aria-live="polite">
              {status}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#2f2f2f] pt-5">
              <label className="button secondary cursor-pointer">
                <ImagePlus size={17} /> Scan saved QR image
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void scanSavedImage(event.target.files?.[0])}
                />
              </label>
              <button className="button secondary" type="button" onClick={close}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
