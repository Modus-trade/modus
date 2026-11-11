import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";

// Native snapshots animate route exit as well as entry without keeping old forms alive.
export function useRouteMotion() {
  const navigate = useNavigate();
  return (event: MouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (
      url.origin !== location.origin ||
      !/^\/(?:tickets(?:\/\d+)?|unassigned|categories|users|overview)?$/.test(
        url.pathname,
      ) ||
      url.hash ||
      !document.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    if (url.pathname === location.pathname && url.search === location.search)
      return;
    event.preventDefault();
    const transition = document.startViewTransition(() => {
      flushSync(() => navigate(url.pathname + url.search));
    });
    // Rapid navigation can skip a snapshot; the navigation still completes.
    void transition.ready.catch(() => {});
  };
}

export function Disclosure({
  open,
  children,
  id,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="disclosure"
      data-open={open}
      aria-hidden={!open}
      ref={(node) => node?.toggleAttribute("inert", !open)}
    >
      <div className="disclosure-inner">{children}</div>
    </div>
  );
}

export function AnimatedTabs({
  value,
  children,
  label,
}: {
  value: string;
  children: ReactNode;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const selected =
        element.querySelector<HTMLButtonElement>("button.selected");
      setIndicator(
        selected
          ? { left: selected.offsetLeft, width: selected.offsetWidth }
          : { left: 0, width: 0 },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);
  return (
    <div
      ref={root}
      className="list-tabs animated-tabs"
      role="group"
      aria-label={label}
    >
      {children}
      <span
        className="tab-indicator"
        aria-hidden="true"
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
          opacity: indicator.width ? 1 : 0,
        }}
      />
    </div>
  );
}
