import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  adminGetPlaylists,
  adminGetPlaylist,
  adminGetPresentation,
  adminLock,
  adminUnlock,
  adminGetLock,
  adminGetSpeakerPin,
  adminSetSpeakerPin,
  speakerSlideThumbUrl,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import Logo from "./Logo";
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  LogoutIcon,
  PlaylistIcon,
  SlidesIcon,
} from "./Icons";

interface Props {
  pin: string;
  onLogout: () => void;
}

interface PlaylistItem {
  id: { uuid: string; name: string; index: number };
  type: string;
  items?: PlaylistItem[];
  presentation_info?: { presentation_uuid: string };
}

interface LockedInfo {
  uuid: string;
  name: string;
  slideCount: number;
}

function Section({
  title,
  footer,
  className = "",
  children,
}: {
  title: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h2 className="mb-2 px-4 text-[13px] font-semibold text-muted">{title}</h2>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
    </section>
  );
}

function StatusDot({ state }: { state: boolean | null }) {
  const color = state === null ? "bg-faint" : state ? "bg-success" : "bg-danger";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {state && (
        <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50 [animation-duration:2.4s]" />
      )}
      <span className={`relative h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export default function AdminPanel({ pin, onLogout }: Props) {
  const { t, plural } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [locked, setLocked] = useState<LockedInfo | null>(null);
  const [lockingUuid, setLockingUuid] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [speakerPin, setSpeakerPinState] = useState<string | null>(null);
  const [speakerPinDraft, setSpeakerPinDraft] = useState("");
  const [speakerPinSaving, setSpeakerPinSaving] = useState(false);
  const [speakerPinSaved, setSpeakerPinSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // null = unknown (haven't checked yet), avoids banner flash on mount
  const [ppConnected, setPpConnected] = useState<boolean | null>(null);

  const loadLock = useCallback(async () => {
    try {
      const data = await adminGetLock(pin);
      setLocked(data.locked || null);
    } catch {
      /* ignore */
    }
  }, [pin]);

  const loadSpeakerPin = useCallback(async () => {
    try {
      const data = await adminGetSpeakerPin(pin);
      setSpeakerPinState(data?.pin ?? null);
      setSpeakerPinDraft(data?.pin ?? "");
    } catch {
      /* ignore */
    }
  }, [pin]);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetPlaylists(pin);
      setPlaylists(data || []);
    } catch {
      setError(t("cannotConnect"));
    } finally {
      setLoading(false);
    }
    // t is read inside but only used for the error string; intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    loadPlaylists();
    loadLock();
    loadSpeakerPin();
  }, [loadLock, loadPlaylists, loadSpeakerPin]);

  // Poll /api/health so we can show a "PP not running" banner and auto-recover
  // when the user starts ProPresenter without needing a manual refresh.
  const reloadRef = useRef(() => {
    loadPlaylists();
    loadLock();
  });
  reloadRef.current = () => {
    loadPlaylists();
    loadLock();
  };

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      let next: boolean;
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        next = data.pp === true;
      } catch {
        next = false;
      }
      if (cancelled) return;
      setPpConnected((prev) => {
        if (prev === false && next === true) {
          // Transition offline → online: re-fetch lists
          reloadRef.current();
        }
        return next;
      });
    };
    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setThumbFailed(false);
  }, [locked?.uuid, speakerPin]);

  async function togglePlaylist(id: string) {
    if (expandedPlaylist === id) {
      setExpandedPlaylist(null);
      setPlaylistItems([]);
      return;
    }
    setExpandedPlaylist(id);
    setPlaylistItems([]);
    setItemsLoading(true);
    try {
      const data = await adminGetPlaylist(pin, id);
      setPlaylistItems(data?.items || []);
    } catch {
      setPlaylistItems([]);
    } finally {
      setItemsLoading(false);
    }
  }

  async function handleLock(uuid: string, name: string) {
    setLoading(true);
    setLockingUuid(uuid);
    try {
      const data = await adminGetPresentation(pin, uuid);
      const pres = data?.presentation;
      const slideCount = pres?.groups
        ? pres.groups.reduce(
            (sum: number, g: { slides?: unknown[] }) =>
              sum + (g.slides?.length || 0),
            0
          )
        : 0;
      await adminLock(pin, uuid, name, slideCount);
      setLocked({ uuid, name, slideCount });
    } catch {
      setError(t("failedToLock"));
    } finally {
      setLoading(false);
      setLockingUuid(null);
    }
  }

  async function handleUnlock() {
    try {
      await adminUnlock(pin);
      setLocked(null);
    } catch {
      setError(t("failedToUnlock"));
    }
  }

  function flashSaved() {
    setSpeakerPinSaved(true);
    window.setTimeout(() => setSpeakerPinSaved(false), 1600);
  }

  async function handleSaveSpeakerPin() {
    const next = speakerPinDraft.trim();
    setSpeakerPinSaving(true);
    try {
      await adminSetSpeakerPin(pin, next.length ? next : null);
      setSpeakerPinState(next.length ? next : null);
      flashSaved();
    } finally {
      setSpeakerPinSaving(false);
    }
  }

  async function handleClearSpeakerPin() {
    setSpeakerPinSaving(true);
    try {
      await adminSetSpeakerPin(pin, null);
      setSpeakerPinState(null);
      setSpeakerPinDraft("");
    } finally {
      setSpeakerPinSaving(false);
    }
  }

  const statusText =
    ppConnected === null
      ? t("checkingConnection")
      : ppConnected
        ? t("connected")
        : t("ppNotConnected");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[60px] max-w-[1100px] items-center gap-3 px-4">
          <Logo className="h-9 w-9 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] leading-tight font-bold">{t("admin")}</h1>
            <p className="flex items-center gap-1.5 truncate text-[13px] text-muted">
              <StatusDot state={ppConnected} />
              <span className="truncate">{statusText}</span>
            </p>
          </div>
          <LanguageToggle />
          <button
            type="button"
            onClick={onLogout}
            aria-label={t("logout")}
            title={t("logout")}
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-fg"
          >
            <LogoutIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pt-5 pb-[calc(32px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8">
        {/* Left column on iPad / desktop: what the speaker sees */}
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          {ppConnected === false && (
            <div
              className="flex items-start gap-3 rounded-[18px] border border-danger/30 bg-danger/10 p-4"
              role="alert"
            >
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-danger">{t("ppNotConnected")}</p>
                <p className="mt-1 text-[14px] leading-snug text-muted">
                  {t("ppNotConnectedHelp")}
                </p>
              </div>
            </div>
          )}

          <Section title={t("speakerSees")}>
            {locked ? (
              <div className="flex items-center gap-3.5 p-3.5">
                <span className="relative block aspect-video w-[104px] shrink-0 overflow-hidden rounded-[9px] bg-thumb shadow-[0_0_0_2px_var(--app-surface),0_0_0_4px_var(--app-accent)]">
                  {!thumbFailed && (
                    <img
                      src={`${speakerSlideThumbUrl(0, 400, speakerPin)}&p=${encodeURIComponent(locked.uuid)}`}
                      alt=""
                      draggable={false}
                      onError={() => setThumbFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold">{locked.name}</p>
                  <p className="text-[13px] text-muted">
                    {locked.slideCount} {plural("slides", locked.slideCount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUnlock}
                  className="press h-9 shrink-0 rounded-full bg-danger/12 px-3.5 text-[13px] font-bold whitespace-nowrap text-danger"
                >
                  {t("unlock")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 text-[15px] leading-snug text-muted">
                <SlidesIcon className="h-6 w-6 shrink-0 text-faint" />
                {t("noPresentationLocked")}
              </div>
            )}
          </Section>

          {error && (
            <p role="alert" className="px-4 text-[14px] font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Right column on iPad / desktop: playlists */}
        <Section
          title={t("playlists")}
          className="mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0"
        >
          {loading && !playlists.length && (
            <p className="p-4 text-[15px] text-muted">{t("loading")}</p>
          )}
          {!loading && !playlists.length && (
            <p className="p-4 text-[15px] text-muted">{t("noItems")}</p>
          )}
          <ul className="divide-y divide-line">
            {playlists.map((pl) => {
              const expanded = expandedPlaylist === pl.id.uuid;
              const presentations = playlistItems.filter((i) => i.type === "presentation");
              return (
                <li key={pl.id.uuid}>
                  <button
                    type="button"
                    onClick={() => togglePlaylist(pl.id.uuid)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-raised"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent/12 text-accent-ink">
                      <PlaylistIcon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                      {pl.id.name}
                    </span>
                    <ChevronRightIcon
                      className={`h-4 w-4 shrink-0 text-faint transition-transform duration-200 ${
                        expanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {expanded && (
                    <ul className="border-t border-line bg-bg/50 pb-1.5">
                      {itemsLoading && (
                        <li className="py-3 pr-4 pl-[60px] text-[14px] text-muted">
                          {t("loading")}
                        </li>
                      )}
                      {!itemsLoading && presentations.length === 0 && (
                        <li className="py-3 pr-4 pl-[60px] text-[14px] text-muted">
                          {t("noItems")}
                        </li>
                      )}
                      {!itemsLoading &&
                        presentations.length > 0 &&
                        playlistItems.map((item, i) => {
                          if (item.type === "header") {
                            return (
                              <li
                                key={`h-${i}`}
                                className="pt-3 pr-4 pb-1 pl-[60px] text-[12px] font-bold text-muted"
                              >
                                {item.id?.name}
                              </li>
                            );
                          }
                          if (item.type !== "presentation") return null;
                          const presUuid =
                            item.presentation_info?.presentation_uuid || item.id.uuid;
                          const isLocked = locked?.uuid === presUuid;
                          const isLocking = lockingUuid === presUuid;
                          return (
                            <li
                              key={presUuid || i}
                              className="flex items-center gap-3 py-2 pr-3 pl-[60px]"
                            >
                              <span
                                className={`min-w-0 flex-1 truncate text-[15px] ${
                                  isLocked ? "font-bold" : ""
                                }`}
                              >
                                {item.id?.name || t("untitled")}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleLock(presUuid, item.id.name)}
                                disabled={isLocked || isLocking}
                                className={`press inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap ${
                                  isLocked
                                    ? "bg-accent-strong text-white"
                                    : "border border-accent/45 text-accent-ink disabled:opacity-60"
                                }`}
                              >
                                {isLocked && <CheckIcon className="h-3.5 w-3.5" />}
                                {isLocked
                                  ? t("lockedLabel")
                                  : isLocking
                                    ? t("loading")
                                    : t("lock")}
                              </button>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          title={t("speakerPinSection")}
          footer={t("speakerPinHelp")}
          className="mt-6 lg:col-start-1 lg:row-start-2"
        >
          <div className="p-4">
            <p className="flex items-center gap-2 text-[15px] font-medium">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  speakerPin ? "bg-success" : "bg-faint"
                }`}
              />
              {speakerPin ? t("speakerPinIsSet") : t("speakerPinNotSet")}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={t("speakerPinPlaceholder")}
                value={speakerPinDraft}
                onChange={(e) => setSpeakerPinDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !speakerPinSaving &&
                    speakerPinDraft.trim() !== (speakerPin ?? "")
                  ) {
                    handleSaveSpeakerPin();
                  }
                }}
                className="h-11 w-full min-w-0 flex-1 rounded-xl bg-raised px-3.5 text-[17px] tracking-[0.2em] tabular-nums text-fg outline-none placeholder:tracking-normal placeholder:text-faint focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleSaveSpeakerPin}
                disabled={speakerPinSaving || speakerPinDraft.trim() === (speakerPin ?? "")}
                className={`press inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-4 text-[15px] font-bold text-white ${
                  speakerPinSaved
                    ? "bg-success"
                    : "bg-accent-strong disabled:bg-raised disabled:text-faint"
                }`}
              >
                {speakerPinSaved && <CheckIcon className="h-4 w-4" />}
                {speakerPinSaved ? t("saved") : t("save")}
              </button>
              <button
                type="button"
                onClick={handleClearSpeakerPin}
                disabled={speakerPinSaving || !speakerPin}
                className="press h-11 shrink-0 rounded-xl bg-raised px-4 text-[15px] font-semibold text-fg disabled:text-faint"
              >
                {t("clear")}
              </button>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
