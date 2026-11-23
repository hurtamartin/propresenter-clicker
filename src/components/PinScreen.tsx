import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import Logo from "./Logo";
import { BackspaceIcon } from "./Icons";

interface Props {
  title: string;
  verify: (pin: string) => Promise<unknown>;
  onAuth: (pin: string) => void;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MAX_LEN = 12;

// Passcode-style PIN entry: on-screen keypad (no system keyboard popping up and
// shoving the layout around), plus hardware keyboard and paste support.
export default function PinScreen({ title, verify, onAuth }: Props) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const pinRef = useRef(pin);
  pinRef.current = pin;

  const press = useCallback((d: string) => {
    setError("");
    setPin((p) => (p.length >= MAX_LEN ? p : p + d));
  }, []);

  const backspace = useCallback(() => setPin((p) => p.slice(0, -1)), []);

  const submit = useCallback(async () => {
    const value = pinRef.current;
    if (!value || loading) return;
    setError("");
    setLoading(true);
    try {
      await verify(value);
      onAuth(value);
    } catch {
      setError(t("invalidPin"));
      setPin("");
      setShake((n) => n + 1);
      navigator.vibrate?.([30, 40, 30]);
    } finally {
      setLoading(false);
    }
  }, [loading, verify, onAuth, t]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    }
    function onPaste(e: ClipboardEvent) {
      const digits = e.clipboardData?.getData("text").replace(/\D/g, "") ?? "";
      if (digits) setPin(digits.slice(0, MAX_LEN));
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [press, backspace, submit]);

  const slots = Math.max(4, pin.length);
  const key =
    "press grid aspect-square w-full place-items-center rounded-full bg-raised text-[28px] font-semibold tabular-nums text-fg active:bg-faint/40";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pt-[max(56px,env(safe-area-inset-top))] short:pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-4 z-10">
        <LanguageToggle />
      </div>

      <Logo className="h-14 w-14 rounded-[16px] short:h-12 short:w-12 shadow-[0_8px_24px_-8px_rgb(255_106_26/0.55)]" />
      <h1 className="mt-5 text-[24px] short:mt-3 short:text-[22px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-[15px] text-muted">{t("enterPin")}</p>

      <div
        key={shake}
        className={`mt-7 flex h-4 short:mt-4 items-center gap-3.5 ${shake ? "animate-shake" : ""}`}
        aria-label={`${pin.length} / ${slots}`}
      >
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < pin.length
                ? "animate-pop border-accent bg-accent"
                : "border-faint bg-transparent"
            }`}
          />
        ))}
      </div>

      <p role="alert" className="mt-4 h-5 text-[14px] short:mt-2 font-medium text-danger">
        {error}
      </p>

      <div className="mt-4 grid w-full max-w-[288px] grid-cols-3 gap-x-6 gap-y-4 short:mt-2 short:max-w-[252px] short:gap-x-5 short:gap-y-3">
        {DIGITS.map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className={key} onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          disabled={!pin}
          aria-label={t("deleteDigit")}
          className="press grid aspect-square w-full place-items-center rounded-full text-muted disabled:opacity-30"
        >
          <BackspaceIcon className="h-7 w-7" />
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading || !pin}
        className="press mt-8 h-[52px] short:mt-5 w-full max-w-[288px] rounded-2xl bg-accent-strong text-[17px] font-bold text-white disabled:bg-raised disabled:text-faint"
      >
        {loading ? t("checking") : t("login")}
      </button>
    </div>
  );
}
