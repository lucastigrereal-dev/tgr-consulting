import React, { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/staging-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "Usuário ou senha inválidos."
            : "Não foi possível iniciar a sessão de staging.",
        );
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Staging indisponível. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090a0c] px-5 py-12 text-[#f5f1e8]">
      <section className="w-full max-w-md rounded-3xl border border-[#b7944b]/30 bg-[#111317] p-7 shadow-2xl sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d0ab61]">
          Ambiente de staging
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">TGR Consulting</h1>
        <p className="mt-3 text-sm leading-6 text-[#a9a49a]">
          Acesso controlado ao estudo vivo de viabilidade. Este ambiente não é produção.
        </p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              className="border-white/15 bg-black/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={16}
              className="border-white/15 bg-black/30"
            />
          </div>
          {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full bg-[#b7944b] text-black hover:bg-[#d0ab61]">
            {loading ? "Validando…" : "Entrar com segurança"}
          </Button>
        </form>
      </section>
    </main>
  );
}
