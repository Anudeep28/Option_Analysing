"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import type { OptionType } from "@/lib/types";

interface PayoffChartProps {
  optionType: OptionType;
  strikePrice: number;
  premium: number;
  spotPrice: number;
}

export function PayoffChart({ optionType, strikePrice, premium, spotPrice }: PayoffChartProps) {
  const range = strikePrice * 0.5;
  const low = Math.max(strikePrice - range, 0.01);
  const high = strikePrice + range;
  const step = (high - low) / 200;

  const data = [];
  for (let s = low; s <= high; s += step) {
    let intrinsic: number;
    if (optionType === "call") {
      intrinsic = Math.max(s - strikePrice, 0);
    } else {
      intrinsic = Math.max(strikePrice - s, 0);
    }
    const pnl = intrinsic - premium;

    data.push({
      spot: parseFloat(s.toFixed(2)),
      payoff: parseFloat(intrinsic.toFixed(4)),
      pnl: parseFloat(pnl.toFixed(4)),
    });
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="spot"
            label={{ value: "Spot Price at Expiry", position: "insideBottom", offset: -2, style: { fontSize: 12 } }}
            tickFormatter={(v: number) => v.toFixed(0)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: "P&L", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              Number(value).toFixed(4),
              name === "pnl" ? "P&L (net of premium)" : "Payoff (gross)",
            ]}
            labelFormatter={(label: unknown) => `Spot: ${Number(label).toFixed(2)}`}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
          <ReferenceLine x={strikePrice} stroke="#888" strokeDasharray="5 5" label={{ value: "K", position: "top", fontSize: 11 }} />
          <ReferenceLine x={spotPrice} stroke="#3b82f6" strokeDasharray="2 2" label={{ value: "S₀", position: "top", fontSize: 11 }} />
          <Line type="monotone" dataKey="payoff" stroke="#10b981" strokeWidth={2} dot={false} name="Payoff (gross)" />
          <Line type="monotone" dataKey="pnl" stroke="#ef4444" strokeWidth={2} dot={false} name="P&L (net of premium)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
