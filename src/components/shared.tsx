"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Layers2, Moon, Sun } from "lucide-react";
import { initials } from "@/lib/utils";
import { useAsset } from "@/hooks/use-asset";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Layers2 size={21} />
      </span>
      {!compact && (
        <>
          SyncRoom<span className="brand-period">.</span>
        </>
      )}
    </span>
  );
}
export function Avatar({
  name,
  url,
  online,
  small = false,
}: {
  name: string;
  url?: string | null;
  online?: boolean;
  small?: boolean;
}) {
  const { url: src } = useAsset(url);
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={
        {
          "--avatar-hue": `${(name.charCodeAt(0) * 31) % 360}`,
        } as React.CSSProperties
      }
    >
      {src ? (
        <Image src={src} alt="" width={56} height={56} unoptimized />
      ) : (
        initials(name)
      )}
      {online !== undefined && <i className={online ? "online" : "offline"} />}
    </span>
  );
}
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const next = localStorage.getItem("syncroom-theme") === "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    requestAnimationFrame(() => setDark(next));
  }, []);
  return (
    <button
      className="icon-button"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => {
        document.documentElement.dataset.theme = dark ? "light" : "dark";
        localStorage.setItem("syncroom-theme", dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
