import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BoardroomPremiumShell,
  resolveBoardroomKeyboardAction,
  resolveBoardroomStep,
  shouldHandleBoardroomHotkey,
} from "./BoardroomPremiumShell";
import { LIVE_DOCUMENT_CHAPTERS } from "@/lib/liveDocumentStructure";

const escaped = (value: string) => value.replaceAll("&", "&amp;");

describe("BoardroomPremiumShell", () => {
  it("renders a dedicated 16:9 presenter shell with all BRD chapters", () => {
    const html = renderToStaticMarkup(
      <BoardroomPremiumShell projectSelector={<span>Projeto Cotia</span>}>
        <section>Conteúdo executivo</section>
      </BoardroomPremiumShell>
    );

    expect(html).toContain('data-boardroom-shell="premium"');
    expect(html).toContain("aspect-video");
    expect(html).toContain("Presenter mode");
    expect(html).toContain("Tela cheia");
    for (const chapter of LIVE_DOCUMENT_CHAPTERS) {
      expect(html).toContain(escaped(chapter.title));
      expect(html).toContain(chapter.href);
    }
  });

  it("maps presentation keys to chapter and fullscreen actions", () => {
    expect(resolveBoardroomKeyboardAction("ArrowRight")).toBe("next");
    expect(resolveBoardroomKeyboardAction("ArrowLeft")).toBe("previous");
    expect(resolveBoardroomKeyboardAction("f")).toBe("toggleFullscreen");
    expect(resolveBoardroomKeyboardAction("F")).toBe("toggleFullscreen");
    expect(resolveBoardroomKeyboardAction("Escape")).toBe("exitPresenter");
    expect(resolveBoardroomKeyboardAction("Tab")).toBeNull();
  });

  it("keeps previous and next navigation inside chapter bounds", () => {
    expect(resolveBoardroomStep(0, "previous", 16)).toBe(0);
    expect(resolveBoardroomStep(0, "next", 16)).toBe(1);
    expect(resolveBoardroomStep(15, "next", 16)).toBe(15);
    expect(resolveBoardroomStep(8, "previous", 16)).toBe(7);
  });

  it("ignores global hotkeys while the user is typing or editing text", () => {
    expect(shouldHandleBoardroomHotkey({ tagName: "INPUT" } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleBoardroomHotkey({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleBoardroomHotkey({ tagName: "SELECT" } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleBoardroomHotkey({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(false);
    expect(shouldHandleBoardroomHotkey({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(true);
  });

  it("uses a visually distinct presenter layout, not just a state attribute", () => {
    const html = renderToStaticMarkup(
      <BoardroomPremiumShell
        initialPresenterMode
        projectSelector={<span>Projeto Cotia</span>}
      >
        <section>Conteúdo executivo</section>
      </BoardroomPremiumShell>
    );

    expect(html).toContain('data-presenter-mode="true"');
    expect(html).toContain("fixed inset-0");
    expect(html).toContain('data-boardroom-stage="presenter"');
    expect(html).toContain("max-h-none");
  });
});
