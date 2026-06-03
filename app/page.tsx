import AskPanel from "../components/AskPanel";

export default function Home() {
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
      <AskPanel />
    </main>
  );
}