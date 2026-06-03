import AskPanel from "../components/AskPanel";
import PolicyPanel from "../components/PolicyPanel";
import ThresholdSlider from "../components/ThresholdSlider";
import ReviewQueue from "../components/ReviewQueue";
import { isRealData, getDb } from "../lib/db";
import { debitsOver50, thresholdCurve } from "../lib/risk";
import { buildReviewQueue } from "../lib/queue";

export default async function Home() {
  const realData = isRealData();
  const db = await getDb();
  const policy = debitsOver50(db);
  const curve = thresholdCurve(db);
  const queue = buildReviewQueue(db, policy.over50Count, policy.debitCount);

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
        gap: 28,
      }}
    >
      <header style={{ maxWidth: 760, width: "100%" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
          SpendGuard AI
        </h1>
        <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginTop: 4 }}>
          Policy reality check and spend intelligence for business card programs.
        </p>
      </header>
      <AskPanel syntheticData={!realData} />
      <PolicyPanel
        over50Count={policy.over50Count}
        debitCount={policy.debitCount}
        percentage={policy.percentage}
        slider={<ThresholdSlider curve={curve} />}
      />
      <ReviewQueue
        highRisk={queue.highRisk}
        documentationCount={queue.documentationRequired.count}
        clearedCount={queue.cleared.count}
        caveat={queue.caveat}
      />
    </main>
  );
}