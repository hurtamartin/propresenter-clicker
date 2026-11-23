import { useState, useEffect, useCallback, useRef } from "react";
import {
  speakerAuth,
  speakerGetPresentation,
  speakerGetSlides,
  speakerGetStatus,
  speakerTriggerSlide,
  speakerNext,
  speakerPrevious,
  speakerSlideThumbUrl,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import DvdBouncer from "./DvdBouncer";
import SpeakerLogin from "./SpeakerLogin";
import Logo from "./Logo";
import Segmented from "./Segmented";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreIcon,
  OfflineIcon,
} from "./Icons";

const SPEAKER_PIN_STORAGE_KEY = "speakerAuth";
const SPEAKER_PIN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredSpeakerAuth = { pin: string; expiresAt: number };

function loadStoredSpeakerPin(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SPEAKER_PIN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSpeakerAuth;
    if (typeof parsed.pin === "string" && parsed.expiresAt > Date.now()) {
      return parsed.pin;
    }
  } catch {
    /* malformed — fall through to clear */
  }
  window.localStorage.removeItem(SPEAKER_PIN_STORAGE_KEY);
  return null;
}

function storeSpeakerPin(pin: string) {
  const entry: StoredSpeakerAuth = {
    pin,
    expiresAt: Date.now() + SPEAKER_PIN_TTL_MS,
  };
  window.localStorage.setItem(SPEAKER_PIN_STORAGE_KEY, JSON.stringify(entry));
}

function clearStoredSpeakerPin() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SPEAKER_PIN_STORAGE_KEY);
}

// --- Per-device view preferences (pinch-zoom is disabled, so slide size is a
// setting instead) ---

type SlideSize = "s" | "m" | "l";

// Column count per size and screen width (phone / iPad portrait / iPad
// landscape / desktop). Explicit counts rather than auto-fill so tablets get
// big, readable thumbnails instead of a sea of small ones.
const GRID_COLS: Record<SlideSize, string> = {
  s: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
  m: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5",
  l: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
};

function usePref<T extends string | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* storage unavailable — use default */
    }
    return initial;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

type SlideMeta = { group: string | null; color: string | null; label: string | null };

// "unknown" while we check whether a PIN is required; null = no PIN required;
// string = authenticated with this PIN.
type AuthState = "unknown" | { pin: string | null };

export default function SpeakerView() {
  const { t, plural } = useI18n();
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [presentation, setPresentation] = useState<{
    locked: boolean;
    uuid?: string;
    name?: string;
    slideCount?: number;
  } | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(-1);
  const [slideMeta, setSlideMeta] = useState<SlideMeta[]>([]);
  const [offline, setOffline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideSize, setSlideSize] = usePref<SlideSize>("speakerSlideSize", "m");
  const [follow, setFollow] = usePref<boolean>("speakerFollowLive", true);
  const activeSlideRef = useRef<HTMLButtonElement | null>(null);

  // Probe the server on mount: if no PIN is required, sail through; if one is
  // required, try the stored PIN before falling back to the login screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadStoredSpeakerPin();
      try {
        const data = await speakerAuth(stored);
        if (cancelled) return;
        if (data?.required) {
          setAuth({ pin: stored });
        } else {
          setAuth({ pin: null });
        }
      } catch {
        if (cancelled) return;
        clearStoredSpeakerPin();
        setAuth({ pin: "" }); // triggers login screen below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If any speaker call returns 401 the admin probably set/changed the PIN.
  // Wipe local state so the user is sent back to the login screen.
  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof Error && /HTTP 401|Speaker PIN/i.test(err.message)) {
      clearStoredSpeakerPin();
      setAuth({ pin: "" });
      return true;
    }
    return false;
  }, []);

  const loadPresentation = useCallback(async () => {
    if (auth === "unknown" || auth.pin === "") return;
    try {
      const data = await speakerGetPresentation(auth.pin);
      setPresentation(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      /* offline */
    }
  }, [auth, handleAuthError]);

  const pollStatus = useCallback(async () => {
    if (auth === "unknown" || auth.pin === "") return;
    try {
      const data = await speakerGetStatus(auth.pin);
      setOffline(false);
      if (data?.slide_index !== undefined) {
        setActiveSlideIndex(data.slide_index);
      }
    } catch (err) {
      if (!handleAuthError(err)) setOffline(true);
    }
  }, [auth, handleAuthError]);

  useEffect(() => {
    if (auth === "unknown" || auth.pin === "") return;
    loadPresentation();
    const presInterval = setInterval(loadPresentation, 3000);
    return () => clearInterval(presInterval);
  }, [auth, loadPresentation]);

  useEffect(() => {
    if (auth === "unknown" || auth.pin === "") return;
    pollStatus();
    const statusInterval = setInterval(pollStatus, 2000);
    return () => clearInterval(statusInterval);
  }, [auth, pollStatus]);

  const pin = auth !== "unknown" ? auth.pin : null;
  const lockedUuid = presentation?.locked ? presentation.uuid : undefined;

  // Group names/colors are decorative; fetched once per locked presentation.
  useEffect(() => {
    setSlideMeta([]);
    if (!lockedUuid) return;
    let cancelled = false;
    speakerGetSlides(pin)
      .then((data) => {
        if (!cancelled) setSlideMeta(data?.slides || []);
      })
      .catch(() => {
        /* fall back to plain numbers */
      });
    return () => {
      cancelled = true;
    };
  }, [lockedUuid, pin]);

  useEffect(() => {
    if (!follow) return;
    activeSlideRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSlideIndex, follow]);

  // Keep the screen awake while presenting (re-acquired when the tab returns,
  // because the OS releases it on visibility change).
  useEffect(() => {
    if (!lockedUuid || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* denied (battery saver, unsupported) — not critical */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [lockedUuid]);

  async function handleTrigger(index: number) {
    setActiveSlideIndex(index);
    navigator.vibrate?.(8);
    try {
      await speakerTriggerSlide(index, pin);
    } catch (err) {
      handleAuthError(err);
    }
  }

  async function handleNext() {
    setActiveSlideIndex((prev) => prev + 1);
    navigator.vibrate?.(8);
    try {
      await speakerNext(pin);
    } catch (err) {
      if (handleAuthError(err)) return;
    }
    setTimeout(pollStatus, 500);
  }

  async function handlePrevious() {
    setActiveSlideIndex((prev) => Math.max(0, prev - 1));
    navigator.vibrate?.(8);
    try {
      await speakerPrevious(pin);
    } catch (err) {
      if (handleAuthError(err)) return;
    }
    setTimeout(pollStatus, 500);
  }

  // Bluetooth presentation clickers and keyboards send arrows / Page Up/Down.
  const navRef = useRef({ next: handleNext, prev: handlePrevious });
  navRef.current = { next: handleNext, prev: handlePrevious };
  useEffect(() => {
    if (!lockedUuid) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        navRef.current.next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navRef.current.prev();
      } else if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lockedUuid]);

  function handleSpeakerAuth(p: string) {
    storeSpeakerPin(p);
    setAuth({ pin: p });
  }

  if (auth === "unknown") {
    return <div className="min-h-dvh" />;
  }

  if (auth.pin === "") {
    return <SpeakerLogin onAuth={handleSpeakerAuth} />;
  }

  if (!presentation || !presentation.locked) {
    return (
      <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
        <DvdBouncer />

        <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-4 z-10">
          <LanguageToggle />
        </div>

        <Logo className="h-[72px] w-[72px] rounded-[20px] shadow-[0_12px_32px_-10px_rgb(255_106_26/0.6)]" />
        <h1 className="mt-6 text-[28px] font-extrabold tracking-tight">
          ProPresenter clicker
        </h1>
        <p className="mt-2 max-w-[300px] text-[15px] text-muted">{t("slogan")}</p>

        <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-line bg-surface/80 px-4 py-2.5 text-[14px] text-muted backdrop-blur">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-300ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
          </span>
          {t("waiting")}
        </div>
      </div>
    );
  }

  const slideCount = presentation.slideCount || 0;
  const slides = Array.from({ length: slideCount }, (_, i) => i);
  const liveMeta = slideMeta[activeSlideIndex];
  const liveName = liveMeta?.label || liveMeta?.group;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[60px] max-w-[1600px] items-center gap-3 px-4 sm:px-5">
          <Logo className="h-9 w-9 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] leading-tight font-bold">
              {presentation.name}
            </h1>
            <p className="truncate text-[13px] text-muted">
              {slideCount} {plural("slides", slideCount)}
            </p>
          </div>
          {offline && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-danger/12 px-2.5 py-1 text-[12px] font-semibold text-danger">
              <OfflineIcon className="h-3.5 w-3.5" />
              {t("offline")}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={t("viewOptions")}
            aria-expanded={menuOpen}
            className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              menuOpen ? "bg-accent text-white" : "bg-raised text-fg"
            }`}
          >
            <MoreIcon />
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div
            role="dialog"
            aria-label={t("viewOptions")}
            className="fixed top-[calc(env(safe-area-inset-top)+66px)] right-3 z-40 w-[min(320px,calc(100vw-24px))] origin-top-right animate-sheet rounded-[20px] border border-line bg-surface p-4 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.45)]"
          >
            <p className="mb-2 text-[13px] font-semibold text-muted">{t("slideSize")}</p>
            <Segmented<SlideSize>
              size="md"
              label={t("slideSize")}
              value={slideSize}
              onChange={setSlideSize}
              options={[
                { value: "s", label: t("sizeSmall") },
                { value: "m", label: t("sizeMedium") },
                { value: "l", label: t("sizeLarge") },
              ]}
            />

            <button
              type="button"
              role="switch"
              aria-checked={follow}
              onClick={() => setFollow((f) => !f)}
              className="mt-4 flex w-full items-center justify-between gap-3 border-t border-line pt-4 text-left text-[15px] font-medium"
            >
              {t("followLive")}
              <span
                className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                  follow ? "bg-accent" : "bg-raised"
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
                    follow ? "translate-x-5" : ""
                  }`}
                />
              </span>
            </button>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 text-[15px] font-medium">
              {t("language")}
              <LanguageToggle />
            </div>
          </div>
        </>
      )}

      <main
        className={`mx-auto grid w-full max-w-[1600px] flex-1 content-start gap-x-3 gap-y-4 px-3 pt-4 pb-[calc(104px+env(safe-area-inset-bottom))] sm:gap-x-4 sm:gap-y-5 sm:px-5 ${GRID_COLS[slideSize]}`}
      >
        {slides.map((index) => {
          const isActive = index === activeSlideIndex;
          const meta = slideMeta[index];
          const name = meta?.label || meta?.group;
          return (
            <button
              key={index}
              ref={isActive ? activeSlideRef : null}
              onClick={() => handleTrigger(index)}
              aria-current={isActive ? "true" : undefined}
              aria-label={`${t("slide")} ${index + 1}${name ? `, ${name}` : ""}`}
              className="press flex min-w-0 flex-col gap-2 rounded-[14px] text-left"
            >
              <span
                className={`relative block aspect-video w-full overflow-hidden rounded-[11px] bg-thumb transition-shadow duration-200 ${
                  isActive
                    ? "shadow-[0_0_0_2px_var(--app-bg),0_0_0_5px_var(--app-accent),0_10px_30px_-6px_rgb(255_106_26/0.55)]"
                    : "shadow-[0_0_0_1px_var(--app-line)]"
                }`}
              >
                <img
                  // `p` busts the 60s thumbnail cache when the admin switches
                  // presentation (the URL is otherwise identical).
                  src={`${speakerSlideThumbUrl(index, 400, pin)}&p=${encodeURIComponent(lockedUuid || "")}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="block h-full w-full object-cover"
                />
                {isActive && (
                  <span className="absolute top-2 right-2 rounded-full bg-accent-strong px-2 py-0.5 text-[11px] font-bold text-white shadow">
                    {t("live")}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2 px-1">
                <span
                  className={`text-[14px] font-bold tabular-nums sm:text-[15px] ${
                    isActive ? "text-accent-ink" : "text-fg"
                  }`}
                >
                  {index + 1}
                </span>
                {meta?.color && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_1px_var(--app-line)]"
                    style={{ background: meta.color }}
                  />
                )}
                {name && (
                  <span className="truncate text-[13px] text-muted sm:text-[14px]">{name}</span>
                )}
              </span>
            </button>
          );
        })}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-glass pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 pt-3">
          <button
            type="button"
            onClick={handlePrevious}
            className="press flex h-14 min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl bg-raised text-[16px] font-semibold text-fg"
          >
            <ChevronLeftIcon className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("previous")}</span>
          </button>
          <div className="w-[72px] shrink-0 text-center leading-tight" aria-live="polite">
            <div className="text-[22px] font-extrabold tabular-nums">
              {activeSlideIndex >= 0 ? activeSlideIndex + 1 : "–"}
              <span className="text-[14px] font-semibold text-muted"> / {slideCount}</span>
            </div>
            {liveName && <div className="truncate text-[11px] text-muted">{liveName}</div>}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="press flex h-14 min-w-0 flex-[1.35] items-center justify-center gap-1 rounded-2xl bg-accent-strong text-[17px] font-bold text-white shadow-[0_8px_24px_-8px_rgb(255_106_26/0.7)]"
          >
            <span className="truncate">{t("next")}</span>
            <ChevronRightIcon className="h-5 w-5 shrink-0" />
          </button>
        </div>
      </nav>
    </div>
  );
}
