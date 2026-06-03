# SpendGuard AI

Spend intelligence and policy reality check for business card programs.

## What it does

SpendGuard AI lets a finance manager ask plain-English questions about a company card program and get back the right answer with a fitting visualization: totals, category and monthly breakdowns, top merchants, and policy and risk checks. Every figure shown is computed directly from the transaction data by a deterministic engine. The AI layer only narrates those computed numbers, and the narration is verified against the computed result before display, so the user is structurally protected from seeing a number the data does not support.

## About this project

This project is built on the sample dataset from Brim Financial's sponsored challenge at MPC Hacks 2026. I competed in the general track rather than the Brim challenge, so I built this independently afterward as a focused showcase, acting on advice given at the event that building a project tied to a company you want to join is worth more than sending applications.

The dataset is the dummy sample data Brim provided for the public hackathon challenge (participants were required to publish public repositories). It contains no real customer or production data: it is anonymized, merchant-level transaction data generated for the challenge. The accompanying expense policy used for the policy checks is the sample policy document provided with the challenge.

## Stack

Next.js (App Router, TypeScript), sql.js (in-browser SQLite over the dataset), SheetJS for parsing, Recharts for visualization. The analytical engine is deterministic; an optional Anthropic model narrates results when an API key is present, otherwise a built-in template narrator is used. Both paths show the same computed numbers.

## Data source selection

The app loads the real sample dataset when present. If it is absent (for example in an environment where the file was not deployed), it falls back to a small committed synthetic dataset and labels the interface as demo mode, so the tool degrades gracefully rather than failing.