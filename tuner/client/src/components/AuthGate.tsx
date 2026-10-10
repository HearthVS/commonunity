import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OmTunerMark from "./OmTunerMark";

type AuthState = { authenticated: boolean; configured: boolean };

async function fetchAuth(): Promise<AuthState> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return { authenticated: false, configured: true };
  return res.json();
}

export async function logout(queryClient: ReturnType<typeof useQueryClient>) {
  await fetch("/api/auth/logout", { method: "POST" });
  queryClient.clear();
  queryClient.setQueryData(["auth"], { authenticated: false, configured: true });
}

// Shows the practitioner login until the server confirms a session.
// The intake form is routed outside this gate and stays public.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["auth"], queryFn: fetchAuth });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (data?.authenticated) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Login failed. Please try again.");
        return;
      }
      setPassword("");
      queryClient.setQueryData(["auth"], { authenticated: true, configured: true });
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="flex justify-center"><OmTunerMark size={44} className="text-primary om-logo-glow" /></div>
          <h1 className="font-display text-2xl font-semibold text-foreground">om tuner</h1>
          <p className="text-sm text-muted-foreground">Practitioner login</p>
        </div>
        {data && !data.configured ? (
          <p className="text-sm text-amber-300">
            Login isn't set up on the server yet. Set TUNER_PRACTITIONER_PASSWORD on the Tuner service.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="practitioner-password">Password</Label>
              <Input
                id="practitioner-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? "Checking…" : "Log in"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
