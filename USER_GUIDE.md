# Option Pricing Simulator — Complete User Guide

## Table of Contents
1. [What This App Does](#what-this-app-does)
2. [Starting the App](#starting-the-app)
2.5. [Where the Numbers Come From](#where-the-numbers-come-from)
3. [Tab 1: Option Pricer — Step-by-Step](#tab-1-option-pricer)
4. [Tab 2: My Portfolio — Step-by-Step](#tab-2-my-portfolio)
5. [Results Panels Reference](#results-panels-reference)
6. [Practical Workflow: NSE Options](#practical-workflow-nse-options)
7. [Global Macro Impact In Detail](#global-macro-impact-in-detail)
8. [DeepSeek API Setup](#deepseek-api-setup)
9. [Glossary](#glossary)

---

## What This App Does

This application is a **professional-grade option analysis tool** for Indian (NSE/BSE) and global markets. It combines:

- **Pricing models**: Black-Scholes, Binomial Tree, Monte Carlo (with Longstaff-Schwartz for American options, Heston stochastic vol)
- **Historical data**: 1 year of daily closes from Yahoo Finance, auto-fitted with GARCH(1,1) for accurate current volatility
- **Greeks**: First-order (Δ, Γ, Θ, ν, ρ) and higher-order (Vanna, Volga, Charm, Speed) — the same set used by investment banks
- **Stock Outlook** *(new)*: Consolidated directional signal (STRONG BUY → STRONG SELL), GARCH-based probabilistic price cone, and price target probability — all combined into one panel
- **Global Macro Impact** *(new)*: Rule-based Munger latticework analysis that scores a macro event through six mental models for the specific stock/sector you selected
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

## Where the Numbers Come From

Not every result is a "live market" value. The app mixes four kinds of inputs, and the output you see depends on which one is driving it.

### 1. Fetched market data (updated when you click **Fetch Live Data**)
- **Spot price** from Yahoo Finance (`lastPrice`).
- **Historical daily closes** from Yahoo Finance, used for technical indicators, GARCH vol, and behavioural signals.
- **Dividend yield** approximated from the dividends reported by Yahoo Finance over the last year.
- **NSE option chain** (Indian symbols): strike prices, call/put LTP, open interest, and implied volatilities.
- **News sentiment** from a news API, including a suggested volatility adjustment.
- **India VIX** and **global macro headlines** for the Macro Impact panel.

### 2. Calculated / model-derived values
- **GARCH(1,1) current vol** — fitted to the downloaded historical closes; preferred volatility for pricing and the Stock Outlook panel.
- **Historical annualized vol** — std of daily log returns × √252, used as a fallback when GARCH cannot be fitted.
- **Theoretical option premium & Greeks** — computed by Black-Scholes, Binomial Tree, or Monte Carlo using the active market inputs.
- **Implied volatility (IV)** — solved from the market LTP you enter in the Demat Position Tracker using Newton-Raphson.
- **SVI volatility surface** — calibrated from NSE option-chain IVs to produce a strike-specific surface IV and skew metrics.
- **Stock price probabilities** — first-passage / terminal log-normal probabilities derived from the active volatility.
- **Technical, sentiment, and macro scores** — rule-based composites that bias the price cone and trade-decision probabilities.

### 3. Values you enter or override
- Strike price, days to expiry, option style/type, pricing method.
- Volatility slider — you can override any fetched/calculated value at any time.
- Risk-free rate and dividend yield defaults can be edited.
- Demat entry premium, target premium, stop loss, lot size, and number of lots.
- Barrier level, Asian averaging settings, Monte Carlo simulation count.

### 4. Hardcoded defaults and fallbacks
- **Asset presets** (`src/lib/market-data.ts`) contain representative spot prices, volatilities, and dividend yields for common symbols. These are used until you fetch live data.
- **Default risk-free rates** — 6.5% for Indian symbols, 5.25% for US/global.
- **NSE lot sizes** are stored as a static map and updated periodically by NSE.
- **Sector mappings, technical indicator thresholds, and macro latticework weights** are calibrated rule sets, not live data.
- **AI Report and LLM mental-model reasoning** require a `DEEPSEEK_API_KEY`; otherwise the app falls back to template/rule-based text.

### What this means for results
- **Option Price, Greeks, Scenario P&L Ladder, IV Analysis:** Driven by the active volatility and spot values. If you clicked **Fetch Live Data**, they use live spot + GARCH/historical vol; otherwise they start from the preset defaults and any manual changes you make.
- **Trade Decision / Profit Probability:** Depends heavily on the **entry premium, target, stop, and holding period you type in**, plus the effective volatility selected by the engine (market IV → implied-from-premium → historical/GARCH).
- **Stock Outlook / Price Cone / Target Probability:** Uses GARCH vol + fetched historical closes + optional sentiment/technical/macro scores. Without live data, the cone uses the volatility and spot currently on the form.
- **Global Macro Impact:** Uses fetched headlines and rule-based sector scoring; the optional DeepSeek layer only enriches the narrative.

> **Bottom line:** Live data and calculated volatilities are the *defaults after fetching*, but you are always one slider/edit away from overriding them. Never treat the outputs as a pure "market feed" — they are model estimates conditioned on the inputs you (or the presets) provide.

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

## Results Panels Reference

After clicking "Price Option", the following panels appear on the right in this order. Live data must be fetched first for the Stock Outlook panel to appear.

---

### 1. Option Price Card
- **Option Premium**: Theoretical fair value from your chosen model
- **Intrinsic Value**: Payoff if exercised right now (max(S−K, 0) for call)
- **Time Value**: Premium above intrinsic — what you pay for optionality
- **95% Confidence Interval**: (Monte Carlo only) range of fair values across simulations
- **Execution Time**: How long pricing took in milliseconds

---

### 2. Stock Outlook *(new — appears when live data is loaded)*

This is the stock movement prediction panel. It has three sections:

#### A. Consolidated Directional Signal
Combines 5–6 data sources into a single **STRONG BUY / BUY / NEUTRAL / SELL / STRONG SELL** verdict.

| Input | Weight | What It Measures |
|---|---|---|
| Trend (SMA 50/200) | 35% | Is the stock above or below its moving averages? |
| MACD | 20% | Is momentum bullish or bearish? |
| RSI-14 | 15% | Is the stock overbought (>70) or oversold (<30)? |
| News Sentiment | 15% | Are recent headlines positive or negative? |
| Bollinger Bands | 10% | Is the stock near the upper or lower band? |
| Vol Regime | 5% | Is GARCH vol elevated vs historical? |

- **Score**: -100 (max bearish) to +100 (max bullish)
- **Confidence %**: How strongly the individual signals agree with each other
- **Key Risk**: A warning relevant to the current market environment (e.g. high VIX, elevated GARCH vol)

> **How to use**: Score > +20 → tilt toward calls or bull spreads. Score < -20 → tilt toward puts or bear spreads. Score near 0 → direction unclear, consider neutral/volatility strategies (straddles, strangles).

#### B. Price Range Forecast (GARCH Price Cone)
A fan chart showing where the stock price is likely to be over the next N days, based on GARCH-fitted volatility.

- **Blue centre line**: Expected (drift-adjusted) path
- **Inner band**: 68% confidence interval — stock stays within this range ~2 out of 3 times
- **Outer band**: 95% confidence interval — stock stays within this range ~19 out of 20 times
- **Horizon**: Switch between 7, 14, 21, 30, 45, or 60 days from the dropdown
- The drift is slightly biased by the technical score (bullish setup → expected path tilts upward)

> **How to use**: Check if your target strike sits inside or outside the 95% band. If your strike is well outside, the probability of it being ITM at expiry is low.

#### C. Price Target Probability
Enter any target price to get two probability estimates:

| Metric | Meaning |
|---|---|
| **P(touches target by day N)** | First-passage probability — chance of the stock hitting your target at any point before the horizon, not just at expiry. More useful for option traders. |
| **P(above target at expiry)** | Terminal log-normal probability — where the stock closes relative to your target on the last day. |
| **P(below target at expiry)** | Complementary probability. |

The drift is biased by the technical score so a strong bullish setup increases upside probabilities.

> **Practical example**: You're considering NIFTY 25500 CE when NIFTY is at 25000, 21 days to expiry. Enter 25500 as target. If P(touches 25500 within 21 days) = 38%, that means there's a 38% chance NIFTY touches 25500 at some point — this is your rough probability of the call going deep ITM before expiry.

---

### 3. Demat Position Tracker
Enter your actual entry price to see live P&L:
- Current P&L (per unit and total in ₹)
- Breakeven spot price at expiry
- P&L at ±2%, ±5% spot moves

---

### 4. Greeks
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

---

### 5. Trade Analysis
Plain-English interpretation of your Greeks:
- Is IV high or low relative to historical?
- Is theta decay dangerous for your holding period?
- Is this ITM/ATM/OTM and what does that mean for your trade?

---

### 6. Profit Probability
- Probability of profit at expiry (log-normal distribution)
- Enter the **Market LTP** (from your broker) to get breakeven-adjusted probability
- Payoff diagram showing P&L at various spot prices at expiry

---

### 7. AI Report
Click **"Generate AI Report"** for a written analysis combining sentiment, technicals, pricing verdict, and risk warnings.
> Requires a DeepSeek API key set in `.env.local` as `DEEPSEEK_API_KEY=sk-...` — see [DeepSeek API Setup](#deepseek-api-setup).

---

### 8. IV Analysis
Compares this option's implied volatility vs the 1-year historical realised volatility:
- **IV > HV**: Option is expensive — sellers favoured
- **IV < HV**: Option may be cheap — buyers favoured
- IV Rank (0–100%) and IV Percentile

---

### 9. Option Chain Intelligence *(Indian symbols only)*
- Open Interest by strike — where large positions are concentrated
- Put-Call Ratio (PCR)
- Max Pain level (strike where total option buyer losses are maximised)
- Support/resistance inferred from OI distribution

---

### 10. Technical Analysis
Computed from 1 year of daily historical closes:
- RSI-14: oversold (<30) / neutral / overbought (>70)
- MACD: bullish or bearish momentum
- Bollinger Bands: mean-reversion signal
- SMA-50 / SMA-200: trend direction
- Key support and resistance levels from pivot analysis

---

### 11. Behavioral Signals
- 52-week position (near high vs low)
- Volume surge detection
- Fear & Greed composite score
- VIX interpretation (India VIX for NSE symbols)

---

### 12. GARCH(1,1) Volatility Forecast
- **Current GARCH Vol**: Best estimate of today's realised volatility (used in pricing and Stock Outlook)
- **Long-Run Vol**: Mean-reversion target for volatility
- **Persistence (α+β)**: >0.95 = shocks last a long time (high-vol regime)
- **Shock Half-Life**: Days until a vol spike fades to half
- **30-day forecast chart**: Whether vol is expected to rise, fall, or stay flat

---

### 13. Scenario P&L Ladder
A heatmap matrix of your option's P&L at:
- Spot moves: −10% to +10% (columns)
- IV changes: −20% to +20% (rows)

Green = profit, Red = loss. Use this to stress-test your option against adverse moves in both spot and volatility simultaneously.

---

### 14. Global Macro Impact *(new)*

This panel appears after you click **Fetch Live Data**. It scans recent global macro headlines, ranks the **top 3 most impactful global drivers**, and analyses each through a **Munger latticework** of mental models, specifically for the stock or index you selected.

Instead of a simple "oil up → airlines down" read, it breaks the drivers into second-order effects and shows the combined macro bias for your selected stock:

| Mental Model | Weight | What It Answers |
|---|---|---|
| **Mechanics (first-order)** | 22% | Direct cost/revenue impact on this sector |
| **Incentives** | 14% | How management, consumers, and policymakers change behaviour |
| **Feedback loops** | 14% | Self-reinforcing or self-correcting knock-on effects |
| **Competitive dynamics** | 11% | Who gains or loses relative market position |
| **Mean reversion** | 8% | How much of the shock is likely to fade over time |
| **Inversion** | 5% | The contrarian / overshoot case |
| **Fiscal policy / Government response** | 12% | Subsidies, taxation, PLI, public capex, and regulatory reaction |
| **Liquidity & capital flows** | 9% | FII/DII flows, RBI liquidity, credit availability, and financing costs |
| **Rural demand / Monsoon linkage** | 5% | Rural income, agricultural consumption, and mass-market demand |

The panel shows:
- **Primary macro event** + severity + headline
- **Net directional badge** with a sentiment score from -100 (bearish) to +100 (bullish)
- **Munger latticework summary** — plain-English explanation of the net effect
- **Transmission chain** — how the event flows to the stock price
- **Nine mental-model layers** — each with a sub-score, weight, and reasoning
- **Duration outlook** — how long the impact typically lasts
- **Options implication** — what the event means for IV and strategy selection
- **Inversion signal** — the contrarian take

> **How to use**: Treat the macro score as a bias, not a trade by itself. A strongly bearish macro score on a stock you already own a call on is a warning to reduce size or hedge. A mixed score means direction is unclear — favour non-directional option strategies (straddles, strangles, iron condors).

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

### Step 1 — Get the Market View (Stock Outlook)

1. Open **Option Pricer**, select your symbol (e.g. NIFTY)
2. Click **Fetch Live Data** — spot and GARCH vol auto-fill
3. Click **Price Option** (use any strike for now — you just need the Stock Outlook panel to load)
4. Scroll to **Stock Outlook** and read:
   - **Directional Signal**: Is the consolidated verdict BUY, SELL, or NEUTRAL?
   - **Price Cone**: Set the horizon to your planned holding period (e.g. 21 days). Does your target strike fall inside the 68% band or outside the 95% band?
   - **Target Probability**: Enter your target strike as the target price. What is P(touches target within N days)?

> **Decision rule**:
> - Signal strongly bullish + target within 68% band + P(touch) > 40% → consider buying a call
> - Signal strongly bearish + target within 68% band + P(touch) > 40% → consider buying a put
> - Signal neutral → favour selling premium (straddle, strangle, iron condor)
> - P(touch) < 20% → target is unrealistic for the holding period

---

### Step 2 — Evaluate the Specific Option

5. Set your chosen strike, expiry days, and Call/Put
6. Click **Price Option** again
7. Check **GARCH Volatility Forecast**:
   - Current GARCH vol elevated vs long-run → options are expensive, prefer selling
   - Current GARCH vol compressed vs long-run → options are cheap, prefer buying
8. Check **IV Analysis** — is the option richly or cheaply priced relative to historical vol?
9. Check **Scenario P&L Ladder** — stress test: what happens if spot drops 5% and IV spikes 20%?
10. Enter your target exit and stop loss in **Trade Decision** — verify the verdict (GO / FAVORABLE / etc.)

---

### Step 3 — Track After Entry

11. Open **My Portfolio** tab, click **Add Leg**
12. Enter your actual entry premium (from your broker confirmation slip)
13. Set current spot, days remaining, IV
14. Check:
    - **Net Theta**: You're losing this amount per day if long
    - **Spot Scenarios**: Where do you break even? Where do you make the most?
    - **Portfolio Greeks**: Are you directionally exposed? Do you need a hedge?
15. Revisit daily to update spot price and days remaining — P&L and Greeks update automatically

---

### Finding IV for the Portfolio Tab

The portfolio tab requires IV as an input (not provided by broker directly):
1. In **Option Pricer**, enter the same strike, expiry, and spot
2. In **Demat Position Tracker**, enter your broker's current LTP
3. The **IV Analysis** panel shows the implied volatility — copy that number into the Portfolio tab's IV field

---

### Quick Reference: Signal → Strategy

| Stock Outlook Signal | Vol Regime | Suggested Strategy |
|---|---|---|
| Strong BUY | Compressed vol | Buy Call (plain or spread) |
| Strong BUY | Elevated vol | Bull Call Spread (limit premium paid) |
| Strong SELL | Compressed vol | Buy Put |
| Strong SELL | Elevated vol | Bear Put Spread |
| NEUTRAL | Elevated vol | Sell Strangle / Iron Condor (collect premium) |
| NEUTRAL | Compressed vol | Buy Straddle (long vol, wait for breakout) |

---

## How to Actually Make a Decision — Deep Dive

This section walks through **how to read the numbers** and **what to do with them**. It uses realistic NIFTY examples throughout.

---

### Reading the Stock Outlook Signal

The signal score runs from -100 to +100. Here is what each range means in practice:

| Score Range | Signal | What It Means | What to Do |
|---|---|---|---|
| +50 to +100 | STRONG BUY | Most signals align bullishly — trend up, MACD positive, RSI not overbought, positive news | Buy calls or bull spreads. Avoid selling calls naked. |
| +20 to +49 | BUY | More bullish than bearish but not all signals agree | Lean bullish. Use spreads to reduce risk if vol is elevated. |
| -19 to +19 | NEUTRAL | Signals are mixed or cancelling out | Do not take strong directional bets. Consider straddles, iron condors, or wait for clarity. |
| -20 to -49 | SELL | More bearish than bullish | Lean bearish. Buy puts or bear spreads. |
| -50 to -100 | STRONG SELL | Most signals align bearishly | Buy puts or bear spreads. Avoid buying calls. |

**Confidence %** tells you how much the signals agree:
- **Confidence > 70%**: Signals strongly agree. Higher conviction to act.
- **Confidence 50–70%**: Moderate agreement. Reduce position size.
- **Confidence < 50%**: Signals are split. Treat the signal as weak — wait or use smaller size.

> **Example**: Score = +65, Confidence = 80% → Strong BUY with high conviction. NIFTY is above both 50 and 200 DMA, MACD positive, RSI neutral, positive news. This is a good setup for buying calls.

> **Example**: Score = +30, Confidence = 45% → BUY but low confidence. Maybe trend is up but RSI is overbought and news is negative. Do not buy aggressively — use a bull call spread with a defined max loss.

---

### Reading the Price Cone

The price cone answers: **"Where is the stock realistically going in the next N days?"**

**How to use it for strike selection:**

1. Set the horizon = your planned holding period (e.g. 21 days for a monthly expiry)
2. Look at the **68% band endpoint** — this is the "likely" range the stock will trade in
3. Look at the **95% band endpoint** — this is the "possible but unlikely" range

**Strike selection rules:**
- An ITM or ATM strike will almost always be within the 95% band — reasonable to trade
- A strike at the edge of the 95% band is a lottery ticket (low premium, low probability)
- A strike well outside the 95% band has almost zero probability — avoid as a buyer

> **Example**: NIFTY at 25000, GARCH vol = 14%, 21 days to expiry.
> - 68% band: 24200 to 25800
> - 95% band: 23500 to 26600
> - **25500 CE**: Inside 68% band → reasonable ATM/OTM call with decent probability
> - **26000 CE**: Between 68% and 95% band → low probability, only buy if very bullish
> - **27000 CE**: Outside 95% band → avoid as a buyer (premium is mostly time value, very low delta)

---

### Reading the Target Probability

Two numbers are shown. They mean different things:

**P(touches target by day N)** — *First-passage probability*
- This is the probability the stock **reaches your target at any point** during the holding period
- More useful for option traders because your option gains value the moment the stock moves toward the strike, not just at expiry
- Think of it as: "If I set a limit order to exit at this target, how often would it get hit?"

**P(above target at expiry)** — *Terminal probability*
- This is the probability the stock **closes above your target specifically on expiry day**
- More conservative — a stock can touch 25500 during the month and still close below it at expiry

> **Example**: NIFTY at 25000, target = 25500, 21 days.
> - P(touches 25500 within 21 days) = 38%
> - P(above 25500 at expiry) = 24%
> - **Interpretation**: There's a 38% chance NIFTY reaches 25500 at some point — roughly one in three months. If you're buying the 25500 CE, expect to profit on about 38% of similar setups (before accounting for theta decay).

**What probability threshold to use:**
- > 50%: High probability trade — size up
- 35–50%: Moderate probability — standard size
- 20–35%: Low probability — small size, treat as a speculative bet
- < 20%: Very low — avoid as a buyer; consider selling this strike instead

---

### Reading the Greeks — What They Mean for Your Position

**Delta (Δ)** — Your directional exposure
- Delta 0.5 = option behaves like holding 0.5 shares of the stock
- NIFTY lot = 25 units, so a delta 0.5 call = exposure to 12.5 NIFTY units = ₹3,12,500 at NIFTY 25000
- If Delta = 0.3 and you hold 2 lots: total delta = 0.3 × 25 × 2 = 15 NIFTY units
- **You gain ₹15 per ₹1 rise in NIFTY**

**Theta (Θ)** — Your daily cost of holding
- Theta = -5 means you lose ₹5 per day per unit from time decay
- 2 lots × 25 units × ₹5 = **₹250 lost per day** just from time passing
- Over 21 days = ₹5,250 lost to theta even if NIFTY doesn't move
- Always check: "Can my expected profit overcome the theta bleed?"

**Vega (ν)** — Your volatility exposure
- Vega = 8 means the option gains ₹8 per 1% rise in IV
- If IV rises from 14% to 16% (+2%), you gain ₹16 per unit
- 2 lots × 25 × ₹16 = **₹800 gain from the vol spike**
- Long options (bought) have positive vega — you profit when IV rises
- Short options (sold) have negative vega — you profit when IV falls

**Gamma (Γ)** — How much delta changes
- High gamma near expiry means delta changes rapidly as spot moves
- Good for buyers (delta accelerates in your favour) but dangerous for sellers

---

### Reading the Scenario P&L Ladder

The ladder is a stress test. Read it like this:

- **Rows** = IV changes (-20% to +20%)
- **Columns** = Spot moves (-10% to +10%)
- **Each cell** = Your net P&L if both happen simultaneously

**What to look for:**
1. Find the cell at your expected spot move and roughly zero IV change — is it green (profit)?
2. Find the worst-case cell (spot moves against you AND IV drops) — can you survive that loss?
3. If most of the top half is red (IV rising hurts you), you are short vega — you sold options
4. If the left column (spot falls) is deeply red, you have positive delta (long calls or short puts)

> **Example for a bought NIFTY 25000 CE:**
> The ladder will show:
> - Top-right cell (spot +10%, IV +20%) → dark green (best case — spot and vol both move in your favour)
> - Bottom-left cell (spot -10%, IV -20%) → dark red (worst case — spot falls and IV collapses)
> - Middle row (IV unchanged), right columns (spot +5% to +10%) → green (normal profitable scenario)
> - **Rule**: If even the "spot flat, IV -10%" cell is manageable (small red), your theta risk is under control

---

### Reading the GARCH Volatility Forecast

| Reading | Meaning | Action |
|---|---|---|
| Current GARCH vol **much higher** than long-run vol | Vol is in an elevated regime, likely to mean-revert down | Sell premium — IV will likely fall, making options cheaper. Straddle sellers benefit. |
| Current GARCH vol **much lower** than long-run vol | Vol is compressed, likely to spike up | Buy premium — IV will likely rise, making options more valuable. Straddle buyers benefit. |
| Persistence (α+β) > 0.95 | Vol shocks last a long time | Do not expect vol to revert quickly. High-vol regime may persist for weeks. |
| Half-life > 30 days | Same as above | Factor this into multi-week strategies. |
| 30-day forecast chart trending **up** | Vol expected to rise | Avoid short-premium strategies. |
| 30-day forecast chart trending **down** | Vol expected to fall | Short-premium strategies (sell straddles, iron condors) become more attractive. |

---

### Full Worked Example: Should I Buy NIFTY 25500 CE?

**Scenario**: NIFTY is at 25000. The monthly expiry is 21 days away. You're considering buying the 25500 CE (OTM call).

**Step 1 — Check Stock Outlook**
- Signal Score: +55 (BUY), Confidence: 72%
- NIFTY is above SMA-50 and SMA-200, MACD positive, RSI at 58 (not overbought), news neutral
- ✅ Directional bias is bullish

**Step 2 — Check Price Cone (21-day horizon)**
- 68% band: 24100–25950
- 95% band: 23300–26800
- 25500 is inside the 68% band → reachable in a normal month
- ✅ Strike is within realistic range

**Step 3 — Check Target Probability**
- P(touches 25500 within 21 days) = 42%
- P(above 25500 at expiry) = 29%
- ✅ 42% first-passage probability is moderate — reasonable for a directional trade

**Step 4 — Price the Option**
- Click Price Option with 25500 CE, 21 days, GARCH vol = 14%
- Theoretical premium = ₹85, Market LTP = ₹90
- IV Analysis: IV = 15.2%, HV = 14%, IV Rank = 45% (normal range)
- ✅ Option is slightly expensive (IV > HV) but not extreme

**Step 5 — Check Greeks**
- Delta = 0.38 (you gain ₹0.38 per ₹1 rise in NIFTY)
- Theta = -3.2 (you lose ₹3.20/day per unit → 1 lot × 25 = ₹80/day)
- Vega = 7.1 (you gain ₹7.10 per 1% IV rise)
- Over 21 days theta = ₹80 × 21 = **₹1,680 bleed** for 1 lot
- NIFTY needs to move up ~₹300 (1.2%) just to cover theta
- ✅ Manageable but must move meaningfully

**Step 6 — Check Scenario P&L Ladder**
- Spot +3%, IV unchanged → profit ₹620 per lot ✅
- Spot flat, IV -5% → loss ₹200 per lot (theta + vol drag)
- Spot -3%, IV -10% → loss ₹1,800 per lot (worst case within 1 week)
- ✅ Maximum realistic loss is bounded and acceptable for 1 lot

**Step 7 — Enter Trade Decision**
- Target premium: ₹150, Stop: ₹45, Holding: 15 days
- P(hitting ₹150 first) = 31%, P(hitting ₹45 first) = 28%
- Expected value: positive
- Verdict: **FAVORABLE**

**Conclusion**: The trade has a positive setup — bullish signal, strike within range, 42% touch probability, manageable theta, and a FAVORABLE verdict. Buy 1–2 lots of NIFTY 25500 CE at ₹88–90 with a stop at ₹45.

---

### Common Mistakes to Avoid

- **Buying OTM options outside the 95% price cone**: The math says these almost never pay off. The premium is cheap for a reason.
- **Ignoring theta bleed**: If theta × holding days > 30% of premium paid, time decay is a serious headwind. Either use spreads or hold for fewer days.
- **Trading a NEUTRAL signal directionally**: A score near 0 means no edge. You are gambling on direction, not trading.
- **Buying options when GARCH vol is elevated**: You are paying a high price for vol that is likely to mean-revert down — a double headwind (spot needs to move AND vol needs to not fall).
- **Ignoring confidence %**: A BUY signal at 45% confidence is weak. Reduce size.
- **Not entering in Portfolio tab after trading**: If you don't track theta bleed and P&L in real time, you will hold losing positions too long.

---

## Global Macro Impact In Detail

The **Global Macro Impact** panel is designed to move beyond simple "oil up → airlines down" reasoning. It scans global macro headlines, ranks the **top 3 most impactful drivers**, and analyses each for the **specific stock or index you selected** using a multi-model framework inspired by Charlie Munger's latticework of mental models.

### How It Works

1. **Headline scan**: The app fetches recent global macro headlines (geopolitical, oil, rates, inflation, recession, China, US markets, etc.).
2. **Event classification**: Headlines are classified into macro event types (e.g., oil spike, rate hike, geopolitical risk, INR fall).
3. **Driver ranking**: Events are scored by frequency and severity, and the top 3 are selected as the global drivers for your stock. The primary driver gets the largest weight in the combined macro score.
4. **Sector resolution**: The selected symbol is mapped to a sector (e.g., INDIGO → airlines, TCS → IT services, NIFTY → index).
5. **Latticework scoring**: Each driver is scored across nine mental models, each with a calibrated weight. The summary is written specifically for your selected symbol, not just the sector.
6. **Optional LLM enhancement**: If you set `DEEPSEEK_API_KEY`, the panel sends the rule-based result to the DeepSeek API and receives a richer, stock-specific combined narrative and a contrarian inversion signal. If the key is missing or the API fails, the panel falls back to the deterministic rule-based output.
7. **Output**: A combined net macro score, directional badge, layered reasoning per driver, duration outlook, options implication, and inversion signal (with optional LLM summary).

### The Nine Mental Models

| Model | Weight | Example for Oil Spike + Airlines |
|---|---|---|
| **Mechanics** | 22% | ATF is 35–40% of airline costs; a crude spike directly compresses margins. |
| **Incentives** | 14% | Airlines are incentivised to raise fares, but price elasticity limits pass-through. |
| **Feedback loops** | 14% | Higher fares → lower load factors → revenue decline → cash-flow pressure. |
| **Competitive dynamics** | 11% | Hedged carriers gain relative share; unhedged budget airlines lose. |
| **Mean reversion** | 8% | Oil spikes often fade once geopolitical tension resolves; airline stocks can rebound. |
| **Inversion** | 5% | If broad risk-off overshoots, even well-hedged airlines may become oversold. |
| **Fiscal policy / Government response** | 12% | Higher oil prices widen the fiscal deficit and raise pressure to cut fuel excise or raise subsidies. Airlines get no direct subsidy, but road/rail alternatives become more attractive. |
| **Liquidity & capital flows** | 9% | Oil spike → wider current account deficit → INR weakness → higher import bill and FPI outflows. Funding costs for airlines and NBFCs rise. |
| **Rural demand / Monsoon linkage** | 5% | Fuel inflation erodes rural disposable income, weakening mass-market consumption of bus, train, and two-wheeler travel, indirectly pressuring airline volumes. |

### The Micro-Transmission Flow (India-specific)

The panel now traces the macro shock through the Indian economy to the specific stock:

1. **Macro event** (oil spike, RBI hike, geopolitical risk, etc.)
2. **First-order impact** on the sector (cost, revenue, margin)
3. **Policy response** (subsidy, excise, PLI, RBI stance)
4. **Liquidity/capital-flow effect** (FII flows, INR, credit availability)
5. **Rural/mass-market transmission** (disposable income, agri-linked demand)
6. **Sector-level earnings revision** (analyst estimate changes)
7. **Stock-specific impact** (your selected symbol)
8. **Options implication** (IV, duration, strategy)

### Reading the Macro Score

- **+50 to +100**: Strong bullish macro bias — tailwinds dominate.
- **+20 to +49**: Moderate bullish bias — consider calls or bull spreads.
- **-19 to +19**: Neutral or mixed — macro is not a strong directional edge.
- **-20 to -49**: Moderate bearish bias — consider puts or bear spreads.
- **-50 to -100**: Strong bearish macro bias — headwinds dominate.

> **Important**: The macro score is a *bias*, not a standalone trade signal. Always combine it with the Stock Outlook, technicals, IV analysis, and your own trade plan.

### How to Use It in Practice

**Scenario**: You are considering buying **INDIGO 4500 CE** after an oil spike headline.

1. **Fetch live data** for INDIGO.
2. Scroll to the **Global Macro Impact** panel.
3. If the panel shows:
   - **Macro Bearish (-25)** with mechanics and feedback loops dominating
   - **Duration**: Medium-term (2–6 weeks)
   - **Options implication**: IV spikes on importers — buy puts while IV is rising
   - **Inversion**: watch for oversold quality carriers
4. **Decision**: Reconsider the long call. The macro headwind increases the chance the call loses from both spot direction and elevated IV. If you still want bullish exposure, use a bull call spread to limit premium, or wait for the macro shock to mean-revert.

### Event-Specific Tips

| Event | Sectors Most Affected | Typical Options Read |
|---|---|---|
| **Oil spike** | Airlines, auto, FMCG, oil & gas | IV rises on importers; puts favoured until shock fades. |
| **Rate hike** | Real estate, auto, banking | Rate-sensitive stocks reprice; real estate puts favoured. |
| **Rate cut** | Real estate, banking, auto | Credit growth improves; calls on rate-sensitive sectors. |
| **Geopolitical risk** | Defence, airlines, oil & gas, index | Market-wide IV spike; index straddles short-term, defence calls. |
| **INR fall** | IT services, pharma, airlines, oil & gas | Exporters benefit; importers hurt. |
| **Global recession** | IT services, metals, banking, auto | Cyclical puts; defensive FMCG/pharma relative safety. |
| **China slowdown** | Metals, auto, pharma | Commodity demand pressure; metals puts. |
| **US market crash** | IT services, index, banking | FII outflows; index straddles, IT puts short-term. |
| **Inflation spike** | FMCG, real estate, banking, oil & gas | Margin squeeze; rate-hike risk rises. |

### Caveats

- **Scores are rule-based**: The numeric scores and weights are deterministic and sector-aware. They will not know a specific company's fuel hedge ratio or exact dollar debt exposure.
- **Reasoning is LLM-powered when a key is set**: When `DEEPSEEK_API_KEY` is configured, each of the nine mental-model descriptions is generated by DeepSeek for the specific stock, event, and headline detected — not generic text. Without the key, the panel falls back to rule-based template reasoning.
- **Headline quality matters**: Classification depends on the words in the headline. A vague headline may produce a weak or neutral signal.
- **Mean reversion is probabilistic**: The duration outlook is based on historical patterns, not a forecast of the specific conflict or policy path.
- **Use with other panels**: The macro score is most useful when combined with Stock Outlook, IV analysis, GARCH forecast, and the trade decision engine.

---

## DeepSeek API Setup

The app uses the **DeepSeek API** (`deepseek-chat` model) for three optional AI features. All three degrade gracefully — the app remains fully functional without an API key.

### How to Enable

1. Sign up at [platform.deepseek.com](https://platform.deepseek.com) and create an API key.
2. In the project root, open (or create) `.env.local` and add:
   ```
   DEEPSEEK_API_KEY=sk-your-key-here
   ```
3. **Restart the dev server** (`Ctrl+C`, then `npm run dev`). Next.js only reads `.env.local` at startup.

> The key is read server-side only and is never exposed to the browser.

### The Three AI Features

| Feature | Where | What DeepSeek Does | Fallback if No Key |
|---|---|---|---|
| **Nine Mental Model Reasoning** | Global Macro Impact panel | Generates one precise, stock-specific sentence per model explaining *why* the event impacts this stock through that model's lens | Generic template text (same structure, less specific) |
| **LLM-Enhanced Macro Summary** | Global Macro Impact panel (blue box) | Writes a 3–5 sentence investor-ready combined narrative + a contrarian inversion signal for the specific stock | Panel hidden; rule-based summary shown instead |
| **AI Investment Report** | AI Report panel | Produces a full structured report: verdict (BUY / AVOID / etc.), confidence score, key factors, risks, recommendation, and position sizing | "Generate AI Report" button returns a 503 error |

### Mental Model Reasoning — What Changes With the Key

Without the key, all nine mental model descriptions use a template that substitutes the event name and sector label — the sentences are structurally similar across models.

With the key, DeepSeek receives the actual event, sector, stock symbol, detected headline, and each model's numeric score, then returns one concrete sentence per model grounded in the specific transmission mechanism. For example, for **HDFCBANK + Rate Hike**:

| Model | Without key (template) | With key (LLM) |
|---|---|---|
| **Mechanics** | "A rate hike changes the direct mechanical cash-flow path for banking & financials: higher interest rates lift borrowing costs and tighten liquidity. The immediate read-through is positive for this stock." | "HDFCBANK's NIM expands as floating-rate loans (~60% of book) reprice immediately while deposit costs adjust with a lag of 1–2 quarters." |
| **Incentives** | "Management, investor, and policy incentives shift: higher interest rates... means the reward for risk-taking vs. capital discipline tilts positive." | "Management is incentivised to grow CASA aggressively to lock in cheap funding before deposit repricing erodes the margin benefit." |
| **Rural demand** | "Rural linkage: higher interest rates affect rural incomes... a key micro driver for banking & financials." | "Rural credit demand softens as tractor and agri-loan EMIs rise, but HDFCBANK's rural book is <15% of advances, limiting direct impact." |

### Cost Estimates

DeepSeek pricing is low. A typical session that triggers all three features costs approximately:
- Mental model reasoning: ~700 tokens (~$0.0002)
- Macro summary: ~500 tokens (~$0.0001)
- AI Report: ~1,000 tokens (~$0.0003)
- **Total per full analysis: < $0.001**

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
| **GBM** | Geometric Brownian Motion — the mathematical model underlying Black-Scholes; assumes log-normal price distribution |
| **Price Cone** | A probabilistic fan chart showing where the stock price is likely to be over a future horizon, based on GARCH volatility |
| **First-Passage Probability** | The probability that the stock price touches a target level at any point before the horizon (not just at expiry) — more relevant than terminal probability for option traders |
| **Confidence Interval (68%/95%)** | Statistical range: the stock stays within the 68% band ~2 out of 3 times, and within the 95% band ~19 out of 20 times |
| **Stock Outlook** | The app's directional prediction panel — combines technicals, MACD, RSI, Bollinger, news sentiment, and vol regime into a single BUY/SELL/NEUTRAL signal |
| **Technical Score** | A composite score (-100 to +100) derived from all technical indicators; used to bias drift in the price cone and target probability calculations |
| **Straddle** | Buying both a call and a put at the same strike — profits if the stock moves sharply in either direction |
| **Strangle** | Buying an OTM call and OTM put — cheaper than a straddle, profits from large moves |
| **Iron Condor** | Selling an OTM strangle and buying a further OTM strangle for protection — profits if the stock stays within a range (neutral strategy) |
| **Global Macro Impact** | The app's rule-based macro panel — scans headlines, ranks the top 3 global drivers, and scores each driver's impact on your selected stock/sector through a multi-model latticework |
| **Munger Latticework** | A decision framework inspired by Charlie Munger: analyse a problem through several mental models (mechanics, incentives, feedback loops, competitive dynamics, mean reversion, inversion, fiscal policy, liquidity flows, rural demand) instead of one narrow model |
| **Macro Score** | A composite score (-100 to +100) derived from the Munger latticework; indicates bullish/bearish/mixed bias for the selected stock |
| **Inversion Signal** | The contrarian read inside the macro panel — what the opposite case looks like and whether the market may have overshot |
| **LLM-Enhanced Summary** | An optional narrative generated by the DeepSeek API from the rule-based macro result; enabled by setting `DEEPSEEK_API_KEY` |
