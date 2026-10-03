"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/client";

export function useAsset(path?: string | null) {
  const [asset, setAsset] = useState<{ url?: string; error: boolean }>({
    error: false,
  });
  useEffect(() => {
    let alive = true;
    async function resolve() {
      if (!path) {
        if (alive) setAsset({ error: false });
        return;
      }
      if (path.startsWith("blob:") || path.startsWith("https://")) {
        if (alive) setAsset({ url: path, error: false });
        return;
      }
      try {
        const { data, error } = await browserClient()
          .storage.from("workspace-files")
          .createSignedUrl(path, 300);
        if (alive) setAsset({ url: data?.signedUrl, error: !!error });
      } catch {
        if (alive) setAsset({ error: true });
      }
    }
    void resolve();
    const timer = setInterval(() => void resolve(), 240000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path]);
  return asset;
}
