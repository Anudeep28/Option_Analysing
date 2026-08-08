"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ForecastCompareButtonProps {
  id: number;
  disabled?: boolean;
}

export function ForecastCompareButton({ id, disabled }: ForecastCompareButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forecasts/${id}/compare`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Compare failed" }));
        alert(data.error || "Compare failed");
      } else {
        router.refresh();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" disabled={disabled || loading} onClick={handleCompare}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Compare"}
    </Button>
  );
}
