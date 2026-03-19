import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

const Acesso = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Se já estiver logado, redireciona para o dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/", { replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou senha inválidos");
    } else {
      navigate("/", { replace: true });
    }
    setLoginLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 md:gap-20 max-w-4xl w-full">
        {/* Login card */}
        <div className="w-full max-w-md">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-10 shadow-lg space-y-7">
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-foreground">Acesse sua conta</h1>
              <p className="text-sm text-muted-foreground">
                Preencha seus dados de acesso à plataforma.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-14 rounded-xl border border-input bg-muted/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-14 rounded-xl border border-input bg-muted/50 px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full h-12 rounded-xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loginLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Acessar sua conta
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Hero text */}
        <div className="hidden md:block text-center md:text-left">
          <p className="text-4xl lg:text-5xl font-light text-foreground/80 leading-tight">
            1% mais
          </p>
          <p className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Beauty.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Acesso;
