"use client";

import { useState } from "react";
import styles from "./ThresholdSlider.module.css";
import type { ThresholdPoint } from "../lib/risk";

interface ThresholdSliderProps {
  curve: ThresholdPoint[];   // precomputed server-side, one count per $10 step
}

const fmtInt = (n: number) => n.toLocaleString("en-CA");

export default function ThresholdSlider({ curve }: ThresholdSliderProps) {
  const [idx, setIdx] = useState(0); // start at $50 (curve[0])
  const point = curve[idx];
  const baseline = curve[0];           // the $50 baseline
  const min = curve[0].threshold;
  const max = curve[curve.length - 1].threshold;

  // Tradeoff numbers, all read from the store-computed curve.
  const reducedBy = baseline.count - point.count; // fewer items needing docs vs $50
  const isBaseline = idx === 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Policy simulation: documentation threshold</div>

      <div className={styles.readout}>
        <span className={styles.count}>{fmtInt(point.count)}</span>
        <span className={styles.countSub}>
          charges would require documentation at a ${point.threshold} threshold
        </span>
      </div>

      <div className={styles.sliderRow}>
        <span className={styles.threshLabel}>${point.threshold}</span>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={curve.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="Documentation threshold in dollars"
        />
      </div>
      <div className={styles.ends}>
        <span>${min}</span>
        <span>${max}</span>
      </div>

      <p className={styles.tradeoff}>
        {isBaseline ? (
          <>
            At the policy&apos;s ${baseline.threshold} threshold, {fmtInt(baseline.count)} charges
            need documentation. <span className={styles.tradeoffMuted}>Raise the threshold to see
            the tradeoff: fewer items to review, but smaller charges pass unchecked.</span>
          </>
        ) : (
          <>
            Raising the threshold from ${baseline.threshold} to ${point.threshold} cuts the
            documentation pile by {fmtInt(reducedBy)} charges (from {fmtInt(baseline.count)} to{" "}
            {fmtInt(point.count)}). <span className={styles.tradeoffMuted}>Less review noise, but
            charges between ${baseline.threshold} and ${point.threshold} now pass unchecked.</span>
          </>
        )}
      </p>
    </div>
  );
}