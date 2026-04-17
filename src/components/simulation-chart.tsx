"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { SimulationPath } from "@/lib/types";

interface SimulationChartProps {
  paths: SimulationPath[];
  strikePrice: number;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#0ea5e9", "#a855f7", "#22c55e",
  "#d946ef", "#facc15", "#64748b", "#fb923c", "#2dd4bf",
];

export function SimulationChart({ paths, strikePrice }: SimulationChartProps) {
  if (paths.length === 0) return null;

  // Build data: each row is a time point, each path is a column
  const numPoints = paths[0].timePoints.length;
  const data = [];

  for (let i = 0; i < numPoints; i++) {
    const row: Record<string, number> = { time: parseFloat(paths[0].timePoints[i].toFixed(4)) };
    for (let p = 0; p < paths.length; p++) {
      row[`path${p}`] = parseFloat(paths[p].prices[i].toFixed(2));
    }
    data.push(row);
  }

  // Downsample if too many points
  let displayData = data;
  if (data.length > 300) {
    const step = Math.ceil(data.length / 300);
    displayData = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="time"
            label={{ value: "Time (years)", position: "insideBottom", offset: -2, style: { fontSize: 12 } }}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: "Price", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            labelFormatter={(label: unknown) => `t = ${Number(label).toFixed(4)} yrs`}
            contentStyle={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}
          />
          <ReferenceLine y={strikePrice} stroke="#888" strokeDasharray="5 5" label={{ value: "K", position: "right", fontSize: 11 }} />
          {paths.map((_, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`path${idx}`}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={1}
              dot={false}
              name={`Path ${idx + 1}`}
              opacity={0.7}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
