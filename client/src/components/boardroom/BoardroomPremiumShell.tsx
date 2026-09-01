import { Button } from "@/components/ui/button";
import { LIVE_DOCUMENT_CHAPTERS } from "@/lib/liveDocumentStructure";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

type KeyboardAction = "next" | "previous" | "toggleFullscreen" | "exitPresenter";

export function resolveBoardroomKeyboardAction(key: string): KeyboardAction | null {
  if (key === "ArrowRight") return "next";
  if (key === "ArrowLeft") return "previous";
  if (key.toLowerCase() === "f") return "toggleFullscreen";
  if (key === "Escape") return "exitPresenter";
  return null;
}

export function shouldHandleBoardroomHotkey(target: EventTarget | null) {
  const element = target as
    | {
        tagName?: string;
        isContentEditable?: boolean;
        closest?: (selector: string) => unknown;
      }
    | null;
  if (!element) return true;
  const tagName = element.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return false;
  }
  if (element.isContentEditable) return false;
  if (typeof element.closest === "function" && element.closest("[contenteditable='true']")) {
    return false;
  }
  return true;
}

export function resolveBoardroomStep(
  currentIndex: number,
  action: "next" | "previous",
  chapterCount: number
) {
  const lastIndex = Math.max(0, chapterCount - 1);
  if (action === "next") return Math.min(lastIndex, currentIndex + 1);
  return Math.max(0, currentIndex - 1);
}

type BoardroomChapterVisibility = {
  index: number;
  isIntersecting: boolean;
  top: number;
  rootTop: number;
  rootHeight: number;
};

export function resolveVisibleBoardroomChapterIndex(
  entries: readonly BoardroomChapterVisibility[],
  currentIndex: number
) {
  const visibleEntries = entries.filter(entry => entry.isIntersecting);
  if (visibleEntries.length === 0) return currentIndex;

  const { rootTop, rootHeight } = visibleEntries[0];
  const readingLine = rootTop + rootHeight / 3;
  const entriesAtReadingLine = visibleEntries.filter(entry => entry.top <= readingLine);
  const candidates = entriesAtReadingLine.length > 0 ? entriesAtReadingLine : visibleEntries;

  return candidates.reduce((closest, entry) => {
    if (entriesAtReadingLine.length > 0) {
      return entry.top > closest.top ? entry : closest;
    }
    return entry.top < closest.top ? entry : closest;
  }).index;
}

function getFullscreenElement() {
  if (typeof document === "undefined") return null;
  return document.fullscreenElement;
}

export function BoardroomPremiumShell({
  children,
  projectSelector,
  snapshotBadge,
  initialPresenterMode = false,
}: {
  children: React.ReactNode;
  projectSelector?: React.ReactNode;
  snapshotBadge?: React.ReactNode;
  initialPresenterMode?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [presenterMode, setPresenterMode] = useState(initialPresenterMode);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const programmaticNavigationRef = useRef<number | null>(null);

  const syncHash = (index: number) => {
    if (typeof window === "undefined") return;
    const href = LIVE_DOCUMENT_CHAPTERS[index]?.href;
    if (!href || window.location.hash === href) return;
    window.history.replaceState(window.history.state, "", href);
  };

  const focusChapter = (index: number) => {
    const chapter = LIVE_DOCUMENT_CHAPTERS[index];
    if (!chapter || typeof document === "undefined") return;
    const target = document.querySelector<HTMLElement>(chapter.href);
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    target.focus({ preventScroll: true });
  };

  const moveToChapter = (index: number) => {
    programmaticNavigationRef.current = index;
    setActiveIndex(index);
    syncHash(index);
    focusChapter(index);
  };

  const moveByAction = (action: "next" | "previous") => {
    moveToChapter(resolveBoardroomStep(activeIndex, action, LIVE_DOCUMENT_CHAPTERS.length));
  };

  const enterFullscreen = async () => {
    setPresenterMode(true);
    const root = rootRef.current;
    if (!root?.requestFullscreen) {
      setFullscreenFallback(true);
      return;
    }
    try {
      await root.requestFullscreen();
      setFullscreenFallback(false);
    } catch {
      setFullscreenFallback(true);
    }
  };

  const exitPresenter = async () => {
    setPresenterMode(false);
    setFullscreenFallback(false);
    if (typeof document === "undefined" || !document.exitFullscreen) return;
    if (!getFullscreenElement()) return;
    await document.exitFullscreen();
  };

  const toggleFullscreen = () => {
    if (presenterMode || fullscreenFallback || getFullscreenElement()) {
      void exitPresenter();
      return;
    }
    void enterFullscreen();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleBoardroomHotkey(event.target)) return;
      const action = resolveBoardroomKeyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "next" || action === "previous") moveByAction(action);
      if (action === "toggleFullscreen") toggleFullscreen();
      if (action === "exitPresenter") void exitPresenter();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, presenterMode, fullscreenFallback]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === "undefined") return;

    const chapterElements = LIVE_DOCUMENT_CHAPTERS.map(chapter =>
      document.querySelector<HTMLElement>(chapter.href)
    );
    let animationFrame: number | null = null;

    const updateVisibleChapter = () => {
      animationFrame = null;
      const rootBounds = stage.getBoundingClientRect();
      const requestedIndex = programmaticNavigationRef.current;
      if (requestedIndex !== null) {
        const requestedBounds = chapterElements[requestedIndex]?.getBoundingClientRect();
        const requestedIsVisible =
          requestedBounds &&
          requestedBounds.bottom > rootBounds.top &&
          requestedBounds.top < rootBounds.bottom;
        if (!requestedIsVisible) return;
        programmaticNavigationRef.current = null;
        setActiveIndex(requestedIndex);
        syncHash(requestedIndex);
        return;
      }

      const visibility = chapterElements.flatMap((element, index) => {
        if (!element) return [];
        const bounds = element.getBoundingClientRect();
        return [
          {
            index,
            isIntersecting: bounds.bottom > rootBounds.top && bounds.top < rootBounds.bottom,
            top: bounds.top,
            rootTop: rootBounds.top,
            rootHeight: rootBounds.height,
          },
        ];
      });

      setActiveIndex(currentIndex => {
        const nextIndex = resolveVisibleBoardroomChapterIndex(visibility, currentIndex);
        if (nextIndex === currentIndex) return currentIndex;
        syncHash(nextIndex);
        return nextIndex;
      });
    };

    const scheduleVisibilityUpdate = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(updateVisibleChapter);
    };

    const observer = new IntersectionObserver(scheduleVisibilityUpdate, {
      root: stage,
      threshold: 0,
    });

    for (const element of chapterElements) {
      if (element && stage.contains(element)) observer.observe(element);
    }
    stage.addEventListener("scroll", scheduleVisibilityUpdate, { passive: true });
    window.addEventListener("resize", scheduleVisibilityUpdate);

    const hashIndex = LIVE_DOCUMENT_CHAPTERS.findIndex(
      chapter => chapter.href === window.location.hash
    );
    if (hashIndex >= 0) setActiveIndex(hashIndex);
    scheduleVisibilityUpdate();

    return () => {
      observer.disconnect();
      stage.removeEventListener("scroll", scheduleVisibilityUpdate);
      window.removeEventListener("resize", scheduleVisibilityUpdate);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const activeChapter = LIVE_DOCUMENT_CHAPTERS[activeIndex];
  const isPresenter = presenterMode || fullscreenFallback;

  return (
    <div
      ref={rootRef}
      data-boardroom-shell="premium"
      data-presenter-mode={isPresenter ? "true" : "false"}
      className={
        isPresenter
          ? "fixed inset-0 z-[100] min-h-screen overflow-hidden bg-black text-slate-100"
          : "min-h-screen bg-slate-950 text-slate-100"
      }
    >
      <div
        className={
          isPresenter
            ? "mx-auto flex h-screen min-h-screen max-w-none flex-col gap-2 px-2 py-2"
            : "mx-auto flex min-h-screen max-w-[1920px] flex-col gap-3 px-3 py-3 sm:px-5"
        }
      >
        <header
          className={
            isPresenter
              ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/20 bg-black/85 px-3 py-2 shadow-2xl"
              : "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 shadow-xl"
          }
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              Sala executiva premium · 16:9
            </p>
            <p className="mt-1 truncate text-sm text-slate-300">
              {activeChapter.number} · {activeChapter.title}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {projectSelector}
            {snapshotBadge}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-slate-100"
              onClick={() => setPresenterMode(value => !value)}
            >
              Modo apresentação
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-slate-100"
              onClick={toggleFullscreen}
            >
              {presenterMode || fullscreenFallback ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Maximize2 className="mr-2 h-4 w-4" />
              )}
              Tela cheia
            </Button>
          </div>
        </header>

        <nav
          aria-label="Capítulos do Boardroom"
          className={
            isPresenter
              ? "overflow-x-auto rounded-lg border border-amber-200/15 bg-black/70 p-1.5"
              : "overflow-x-auto rounded-lg border border-white/10 bg-slate-900/85 p-2"
          }
        >
          <div className="flex min-w-max gap-1">
            {LIVE_DOCUMENT_CHAPTERS.map((chapter, index) => (
              <a
                key={chapter.number}
                href={chapter.href}
                aria-current={index === activeIndex ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                  index === activeIndex
                    ? "bg-amber-300 text-slate-950"
                    : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                }`}
                onClick={() => {
                  programmaticNavigationRef.current = index;
                  setActiveIndex(index);
                }}
              >
                <span className="font-mono text-[10px]">{chapter.number}</span>
                <span className="font-medium">{chapter.title}</span>
              </a>
            ))}
          </div>
        </nav>

        <main
          className={
            isPresenter
              ? "flex-1 overflow-hidden rounded-lg border border-amber-200/20 bg-slate-950 shadow-[0_0_80px_rgba(251,191,36,.16)]"
              : "flex-1 overflow-visible rounded-lg border border-white/10 bg-slate-950 shadow-2xl"
          }
        >
          <div
            ref={stageRef}
            data-boardroom-stage={isPresenter ? "presenter" : "standard"}
            className={
              isPresenter
                ? "aspect-video h-full max-h-none min-h-0 w-full overflow-y-auto p-3 text-[1.08rem] sm:p-5 xl:p-7"
                : "min-h-0 w-full overflow-visible p-4 sm:p-6"
            }
          >
            {children}
          </div>
        </main>

        <footer
          className={
            isPresenter
              ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/15 bg-black/70 px-3 py-2"
              : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2"
          }
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5 text-slate-100"
            onClick={() => moveByAction("previous")}
            disabled={activeIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <p className="text-xs text-muted-foreground">
            Use as setas esquerda/direita para navegar, F para tela cheia e Escape para sair.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5 text-slate-100"
            onClick={() => moveByAction("next")}
            disabled={activeIndex === LIVE_DOCUMENT_CHAPTERS.length - 1}
          >
            Próximo
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </footer>
      </div>
    </div>
  );
}
