# Option Pricing Simulator — Complete User Guide

## Table of Contents
1. [What This App Does](#what-this-app-does)
2. [Starting the App](#starting-the-app)
3. [Tab 1: Option Pricer — Step-by-Step](#tab-1-option-pricer)
4. [Tab 2: My Portfolio — Step-by-Step](#tab-2-my-portfolio)
5. [Understanding the Results](#understanding-the-results)
6. [Practical Workflow: NSE Options](#practical-workflow-nse-options)
7. [Glossary](#glossary)

---

## What This App Does

This application is a **professional-grade option analysis tool** for Indian (NSE/BSE) and global markets. It combines:

- **Pricing models**: Black-Scholes, Binomial Tree, Monte Carlo (with Longstaff-Schwartz for American options, Heston stochastic vol)
- **Historical data**: 1 year of daily closes from Yahoo Finance, auto-fitted with GARCH(1,1) for accurate current volatility
- **Greeks**: First-order (Δ, Γ, Θ, ν, ρ) and higher-order (Vanna, Volga, Charm, Speed) — the same set used by investment banks
- **Portfolio analysis**: Enter multiple positions from your demat account and see combined exposure, net Greeks, and scenario P&L
- **Trade decision engine**: Probability of profit, expected value, risk-reward verdict

---

## Starting the App

```powershell
# In the project folder
npm run dev
```

Open your browser to **http://localhost:3000**

You will see two tabs at the top:
- **Option Pricer** — Analyse a single option
- **My Portfolio** — Track all your existing demat positions

---

## Tab 1: Option Pricer

This is the main analysis tool. Use it to price any option, understand its Greeks, and get a buy/sell verdict.

### Step 1 — Select a Symbol

In the left panel, click one of the preset buttons (e.g. **NIFTY**, **BANKNIFTY**, **RELIANCE**, **AAPL**).

This pre-fills spot price, dividend yield, risk-free rate, and lot size with market-appropriate defaults.

> **For Indian NSE options**: Use NIFTY, BANKNIFTY, FINNIFTY, or individual stocks like RELIANCE, TCS, INFY, HDFCBANK.

---

### Step 2 — Fetch Live Market Data

Click the **"Fetch Live Data"** button (cloud icon).

What happens automatically:
- **Spot price** → filled from Yahoo Finance live quote
- **Volatility (σ)** → fitted using **GARCH(1,1)** on 1 year of daily closes — you'll see a **`GARCH`** badge next to the σ slider. This is more accurate than simple historical std.
- **Dividend yield** → estimated from actual dividends paid in the last year
- **Historical closes** → downloaded in background for technical analysis, behavioral signals, and GARCH forecast

> If the GARCH badge is green, you're using the best available volatility estimate. If it shows `HVol`, GARCH had insufficient data and fell back to simple historical std. If neither badge shows, you're using a manual value.

---

### Step 3 — Configure the Option

| Field | What to Enter | Example |
|---|---|---|
| **Option Style** | European (index options expire at expiry only), American (stock options, early exercise possible), Asian/Barrier/Lookback (exotic) | European for NIFTY |
| **Option Type** | Call (CE) if you expect market to go up, Put (PE) if you expect it to go down | Call |
| **Strike Price** | The strike from your option chain (NSE website or broker terminal) | 25000 |
| **Time to Expiry** | Days until expiry from today | 21 |
| **Volatility (σ)** | Auto-filled by GARCH — adjust if you have a different view | 15.5% |
| **Risk-Free Rate** | Approximately 6.5% for India (RBI repo rate), 5.25% for US | 6.5% |
| **Dividend Yield** | Auto-filled from Yahoo — 0% for index options | 0% |

---

### Step 4 — Choose Pricing Method

| Method | When to Use |
|---|---|
| **Black-Scholes** | European options only. Fastest. Closed-form analytical solution. |
| **Binomial Tree** | European or American options. Good for American early-exercise check. |
| **Monte Carlo** | All styles including exotic (Asian, Barrier, Lookback). Most powerful. Uses Longstaff-Schwartz for American, Heston stochastic vol, antithetic variates + Sobol QMC for variance reduction. |

**For Monte Carlo**, you can also set:
- Number of simulations (more = more accurate, slower)
- Time steps
- Heston stochastic volatility model parameters (if you want path-dependent vol)

---

### Step 5 — Click "Price Option"

Results appear on the right side. Scroll down to see all panels.

---

### Step 6 — Enter Your Demat Position (optional)

In the **Demat Position Tracker** card that appears in results:

1. **Entry Premium** → the price you paid/received in your broker terminal (e.g. ₹148.50)
2. **Lot Size** → pre-filled from NSE standard (NIFTY=25, BANKNIFTY=15)
3. **No. of Lots** → how many lots you hold

You'll immediately see:
- Current P&L (per unit and total)
- Breakeven spot price
- P&L at ±2%, ±5% spot moves

---

### Step 7 — Enter Your Trade Target and Stop (optional)

In the **Trade Decision** section, enter:
- **Target Premium** → the price at which you want to exit for profit
- **Stop Loss Premium** → your stop (optional but recommended)
- **Holding Days** → how long you plan to hold

The engine computes:
- **Probability of hitting target** (uses reflection-principle GBM formula, adjusted for news sentiment and technical score)
- **Probability of hitting stop**
- **Expected Value** in ₹
- **Verdict**: GO / FAVORABLE / NEUTRAL / RISKY / AVOID with reasons and warnings

---

## Results Panels — What Each One Shows

After clicking "Price Option", scroll down through these panels in order:

### Option Price Card
- **Option Premium**: The theoretical fair value computed by your chosen model
- **Intrinsic Value**: Payoff if exercised right now (max(S-K,0) for call)
- **Time Value**: Premium above intrinsic — what you're paying for optionality
- **95% Confidence Interval**: (Monte Carlo only) range of fair values
- **Execution Time**: How long pricing took in milliseconds

### Demat Position Tracker
Enter your actual entry price to see live P&L.

### Greeks
| Greek | Meaning | Practical Use |
|---|---|---|
| **Δ Delta** | ₹ change in option per ₹1 spot move | A 0.5 delta call gains ₹0.50 if NIFTY rises ₹1 |
| **Γ Gamma** | How fast delta changes | High gamma = delta moves a lot as spot moves |
| **Θ Theta** | ₹ loss per calendar day (time decay) | -₹5 theta means you lose ₹5/day holding the option |
| **ν Vega** | ₹ change per 1% change in IV | Long options gain when IV rises |
| **ρ Rho** | ₹ change per 1% rate change | Usually small for short-dated options |
| **Vanna** | How delta shifts when IV changes | Important for vol-of-vol hedging |
| **Volga** | How vega changes with IV | Exposure to vol-of-vol |
| **Charm** | How delta drifts each day | How often you need to re-hedge |
| **Speed** | How gamma changes with spot | Third-order sensitivity |

### Trade Analysis
Interprets your Greeks in plain English. Tells you:
- Is IV high or low relative to historical?
- Is theta decay dangerous for your holding period?
- Is this ITM/ATM/OTM and what does that mean for your trade?

### Profit Probability
- Probability of profit at expiry (based on log-normal distribution)
- Enter the **Market LTP** (current market price from your broker) to get the breakeven-adjusted probability
- Payoff diagram at various spot levels

### AI Report
Click **"Generate AI Report"** for a full written analysis of the option including sentiment, technicals, pricing verdict, and risk warnings. Requires an OpenAI API key in `.env.local`.

### IV Analysis
Compares your option's implied volatility (IV) vs the 1-year historical realised volatility:
- **IV > HV**: Option is expensive (sellers favoured)
- **IV < HV**: Option is cheap (buyers favoured)
- Shows IV percentile and rank

### Option Chain Intelligence
If NSE option chain data loads (Indian symbols only):
- Open Interest by strike — where big money is positioned
- Put-Call Ratio
- Max Pain level (strike where most option buyers lose)
- Likely support/resistance from OI concentration

### Technical Analysis
Computed from 1 year of daily historical closes:
- RSI-14: below 30 = oversold, above 70 = overbought
- MACD: bullish/bearish momentum signal
- Bollinger Bands: mean-reversion signal
- SMA-50/200: trend direction (uptrend/downtrend/sideways)
- Support and resistance levels from pivot analysis

### GARCH(1,1) Volatility Forecast
- **Current GARCH Vol**: Best estimate of today's realised volatility (used for pricing)
- **Long-Run Vol**: Where vol will revert to over time
- **Persistence (α+β)**: How long volatility shocks last. >0.95 = very persistent (high vol regime)
- **Shock Half-Life**: Days until a vol spike decays to half
- **30-day forecast chart**: Whether vol is expected to rise, fall, or stay flat
- **Interpretation**: Whether current vol is elevated or compressed vs long-run, and what that means for option buyers vs sellers

### Scenario P&L Ladder
A matrix showing your option's P&L at combinations of:
- Spot moves: -10% to +10%
- IV changes: -20% to +20%

Green cells = profit, red cells = loss. Use this to understand your option's exposure to both direction and volatility simultaneously.

---

## Tab 2: My Portfolio

Use this to enter **all your existing option positions** from your demat account and see your total exposure.

### Step 1 — Click "My Portfolio" tab

### Step 2 — Click "Add Leg" for each option you hold

For each position, fill in:

| Field | What to Enter |
|---|---|
| **Underlying** | Symbol (e.g. NIFTY, BANKNIFTY, RELIANCE) |
| **Type** | Call (CE) or Put (PE) |
| **Buy / Sell** | Buy = you bought it (Long). Sell = you sold/wrote it (Short). |
| **Strike** | The strike price of your contract |
| **Entry (₹)** | The premium you paid (buy) or received (sell) per unit |
| **Lots** | Number of lots you hold |
| **Lot Size** | NSE standard: NIFTY=25, BANKNIFTY=15, FINNIFTY=40, stocks=various |
| **Days to Expiry** | Days remaining until this contract expires |
| **Spot (₹)** | Current price of the underlying |
| **IV (%)** | Implied volatility — use the main pricer to solve for this from your broker's LTP |

### Step 3 — Add all legs, then read the results

Results appear across 4 tabs:

#### Summary Tab
- **Net Portfolio P&L**: Total profit/loss across all your positions right now
- **Net Greeks**: Combined Δ, Γ, Θ, ν, ρ
- **Interpretation**: Plain-English explanation of your overall exposure

Example: If you hold a NIFTY strangle (buy 25200 CE + buy 24800 PE):
- Net Delta ≈ 0 (delta-neutral, no directional bias)
- Net Theta negative (you're bleeding premium daily — theta decay works against you)
- Net Vega positive (you profit if IV spikes)

#### Per-Leg Details Tab
Each option leg shown individually with:
- Entry vs current theoretical premium
- P&L per unit and total P&L
- Individual Greeks scaled by quantity and sign

#### Spot Scenarios Tab
A chart and table showing your **total portfolio P&L** at spot moves from -20% to +20%.
- Identifies your break-even zone
- Shows where you make/lose the most money

#### Portfolio Greeks Tab
Detailed breakdown of aggregated Greeks with:
- **Hedge Insight**: Automatic suggestion — e.g. "Long 0.45 delta. To hedge: sell futures worth 0.45 delta" or "Short 0.30 delta. To hedge: buy futures"
- **Theta warning**: If theta bleed is significant (e.g. losing ₹500/week)

---

## Practical Workflow: NSE Options

### Before entering a trade

1. Open **Option Pricer**, select NIFTY (or your symbol)
2. Click **Fetch Live Data** — σ auto-fills with GARCH vol
3. Set strike = the strike you're considering, days = expiry, type = CE or PE
4. Click **Price Option**
5. Check the GARCH forecast panel — is vol elevated or compressed?
   - Elevated vol (GARCH > long-run) → favour selling options
   - Compressed vol → favour buying options
6. Check the **Scenario P&L Ladder** — what happens to your option if both spot and IV move against you?
7. Enter your target and stop in **Trade Decision** — check the verdict

### After entering a trade

1. Open **My Portfolio**, click **Add Leg**
2. Enter your actual entry premium (from your broker confirmation)
3. Set current spot, days to expiry, IV
4. Check **Net Theta** — if you're long options, you lose this per day
5. Check **Spot Scenarios** — where is your break-even?
6. Revisit daily to track current P&L and updated Greeks

### Finding IV for the Portfolio tab

The portfolio tab needs IV as an input. To find it:
1. In **Option Pricer**, go to the main pricer
2. Set the same strike, expiry, spot
3. Enter the **current market LTP** (from your broker) into the "Market LTP" field in the Demat Position Tracker
4. The IV Analysis panel will show you the implied volatility — use that number in Portfolio

---

## Glossary

| Term | Meaning |
|---|---|
| **CE** | Call option (right to buy) — profits when underlying rises |
| **PE** | Put option (right to sell) — profits when underlying falls |
| **ATM** | At-the-money: strike ≈ spot price |
| **ITM** | In-the-money: call with strike < spot, or put with strike > spot |
| **OTM** | Out-of-the-money: call with strike > spot, or put with strike < spot |
| **Premium** | The price of the option (what you pay/receive) |
| **IV** | Implied Volatility — the market's expectation of future vol, implied by the option's price |
| **GARCH** | Statistical model that estimates current realised volatility from historical price changes |
| **Theta bleed** | Daily loss in option value due to time passing |
| **Delta hedge** | Buying/selling the underlying to offset your option's directional exposure |
| **Lot size** | NSE-mandated minimum trade size. NIFTY=25 units, BANKNIFTY=15 units |
| **LTP** | Last Traded Price — the most recent price your option was bought/sold at on NSE |
| **Max Pain** | The strike at which the maximum number of option buyers lose at expiry |
| **PCR** | Put-Call Ratio — high PCR (>1.2) = bearish sentiment, low PCR (<0.7) = bullish |
| **Black-Scholes** | Mathematical formula for European option pricing (assumes constant vol, no early exercise) |
| **Monte Carlo** | Simulation-based pricing: simulate thousands of possible price paths, average the payoffs |
| **Longstaff-Schwartz** | Algorithm for American option pricing using regression on simulated paths |
| **Heston Model** | Stochastic volatility model where vol itself follows a random process (more realistic) |
| **Vanna** | How your delta hedge changes as volatility moves |
| **Volga** | How your vega exposure changes as volatility moves (vol-of-vol exposure) |
| **SVI** | Stochastic Volatility Inspired — a parametric model for fitting the volatility smile |
