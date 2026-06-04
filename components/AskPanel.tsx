"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import styles from "./AskPanel.module.css";

interface Turn { role: "user" | "assistant"; content: string; }

interface AskResponse {
  question: string;
  intent: { metric: string };
  result: { metric: string; kind: string; data: unknown; label: string };
  narration: string;
  narrationSource: "ai" | "template";
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-CA");

const SUGGESTIONS = [
  "What was our total spend?",
  "How much did we spend on fuel?",
  "Show spend by month",
  "What are the top merchants?",
  "How many charges are over $50?",
  "Show duplicate-charge candidates",
];

export default function AskPanel({ syntheticData = false }: { syntheticData?: boolean }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, history }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: AskResponse = await res.json();
      setAnswer(data);
      setHistory((h) => [
        ...h,
        { role: "user", content: text },
        { role: "assistant", content: data.narration },
      ]);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      {syntheticData && (
        <div className={styles.syntheticNotice}>
          Demo mode: showing synthetic sample data. The full analysis runs on the real statement locally.
        </div>
      )}
      <div className={styles.heading}>Ask your spend data</div>
      <div className={styles.sub}>
        Plain-English questions. Every number is computed from the statement, never invented.
      </div>

      <div className={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className={styles.chip} onClick={() => submit(s)} disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => { e.preventDefault(); submit(question); }}
      >
        <input
          className={styles.input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. how much did we spend on permits?"
          aria-label="Ask a question about your spend data"
          disabled={loading}
        />
        <button className={styles.button} type="submit" disabled={loading || !question.trim()}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && <div className={`${styles.status} ${styles.error}`}>{error}</div>}

      {answer && !error && (
        <div className={styles.result}>
          <ResultView answer={answer} />
          <div className={styles.narration}>
            <span
              className={`${styles.pill} ${answer.narrationSource === "ai" ? styles.pillAi : styles.pillComputed}`}
            >
              {answer.narrationSource === "ai" ? "AI" : "Computed"}
            </span>
            <span className={styles.narrationText}>{answer.narration}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({ answer }: { answer: AskResponse }) {
  const { result } = answer;
  const d = result.data as Record<string, unknown>;

  if (result.metric === "unsupported") {
    return null; // narration carries the capability menu
  }

  if (result.kind === "single") {
    // total_spend, or a filtered category/month single value
    let value: number | null = null;
    let label = result.label;
    if ("total" in d) value = d.total as number;
    else if ("row" in d && d.row) value = (d.row as { total: number }).total;
    return (
      <div>
        <div className={styles.bigLabel}>{label}</div>
        <div className={styles.bigNumber}>{value === null ? "No data" : money(value)}</div>
      </div>
    );
  }

  if (result.kind === "breakdown") {
    const rows = (d.rows as Array<Record<string, unknown>>) ?? [];
    const isMonth = result.metric === "spend_by_month";
    const chartData = rows.map((r) => ({
      name: isMonth ? (r.month as string) : (r.category as string),
      total: r.total as number,
    }));
    return (
      <div>
        <div className={styles.bigLabel}>{result.label}</div>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={280}>
            {isMonth ? (
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                <YAxis tickFormatter={moneyShort} tick={{ fontSize: 12, fill: "var(--text-muted)" }} width={70} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={moneyShort} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="total" fill="var(--brand)" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (result.kind === "policy") {
    const pct = (d.percentage as number) ?? 0;
    const over = (d.over50Count as number) ?? 0;
    const debits = (d.debitCount as number) ?? 0;
    return (
      <div>
        <div className={styles.bigLabel}>{result.label}</div>
        <div className={styles.bigNumber}>{pct}%</div>
        <div className={styles.sub} style={{ marginTop: 4, marginBottom: 0 }}>
          {over.toLocaleString("en-CA")} of {debits.toLocaleString("en-CA")} debits over $50
        </div>
      </div>
    );
  }

  if (result.kind === "ranked") {
    const rows = (d.rows as Array<{ merchant: string; total: number; count: number }>) ?? [];
    return (
      <div>
        <div className={styles.bigLabel}>{result.label}</div>
        <table className={styles.table}>
          <thead>
            <tr><th>Merchant</th><th>Total</th><th>Transactions</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td>{r.merchant}</td><td>{money(r.total)}</td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (result.kind === "risk_groups") {
    const groups = (d.groups as Array<Record<string, unknown>>) ?? [];
    const totalGroups = (d.totalGroups as number) ?? groups.length;
    return (
      <div>
        <div className={styles.bigLabel}>{result.label} ({totalGroups} total)</div>
        <table className={styles.table}>
          <thead>
            <tr><th>Merchant</th><th>Date</th><th>Count</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const amount = "amount" in g ? (g.amount as number) : (g.total as number);
              return (
                <tr key={i}>
                  <td>{g.merchant as string}</td>
                  <td>{g.date as string}</td>
                  <td>{g.count as number}</td>
                  <td>{money(amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className={styles.status}>No view for this result.</div>;
}