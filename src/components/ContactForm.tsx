import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, AtSign, DollarSign, GraduationCap, Users, ChevronLeft, ChevronRight } from "lucide-react";
import intlTelInput from "intl-tel-input";
import "intl-tel-input/build/css/intlTelInput.css";

interface ContactFormProps {
  onSubmit: (data: { name: string; email: string; phone: string; instagram: string; faturamento: string; aluna_biteti: string; faz_curso: string; decisao_parceiro: string }) => void;
}

const ContactForm = ({ onSubmit }: ContactFormProps) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [fazCurso, setFazCurso] = useState("");
  const [alunaBiteti, setAlunaBiteti] = useState("");
  const [alunaBitetiDetalhe, setAlunaBitetiDetalhe] = useState("");
  const [decisaoParceiro, setDecisaoParceiro] = useState("");
  const [error, setError] = useState("");
  const [showFaturamentoConfirm, setShowFaturamentoConfirm] = useState(false);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itiRef = useRef<any>(null);

  const totalSteps = 8;

  // Inicializa intl-tel-input quando o step de telefone for renderizado
  useEffect(() => {
    if (step === 2 && phoneInputRef.current && !itiRef.current) {
      itiRef.current = intlTelInput(phoneInputRef.current, {
        separateDialCode: true,
        preferredCountries: ["br"],
        utilsScript:
          "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
      });
    }
    return () => {
      if (step !== 2 && itiRef.current) {
        itiRef.current.destroy();
        itiRef.current = null;
      }
    };
  }, [step]);

  const getFullPhone = (): string => {
    if (itiRef.current) {
      return itiRef.current.getNumber() || "";
    }
    return phoneInputRef.current?.value || "";
  };

  const validateStep = (): boolean => {
    setError("");
    switch (step) {
      case 0:
        if (!name.trim()) { setError("Nome é obrigatório"); return false; }
        return true;
      case 1:
        if (!email.trim()) { setError("E-mail é obrigatório"); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("E-mail inválido"); return false; }
        return true;
      case 2: {
        const phone = getFullPhone();
        if (!phone || phone.replace(/\D/g, "").length < 8) { setError("WhatsApp é obrigatório"); return false; }
        return true;
      }
      case 3:
        if (!instagram) { setError("Instagram é obrigatório"); return false; }
        return true;
      case 4:
        if (!faturamento) { setError("Selecione uma opção"); return false; }
        return true;
      case 5:
        if (!alunaBiteti) { setError("Selecione uma opção"); return false; }
        if (alunaBiteti === "Sim" && !alunaBitetiDetalhe.trim()) { setError("Informe qual curso/turma"); return false; }
        return true;
      case 6:
        if (!fazCurso) { setError("Selecione uma opção"); return false; }
        return true;
      case 7:
        if (!decisaoParceiro) { setError("Selecione uma opção"); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step === 4 && !showFaturamentoConfirm) {
      setShowFaturamentoConfirm(true);
      return;
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
      setError("");
    } else {
      onSubmit({
        name: name.trim(),
        email: email.trim(),
        phone: getFullPhone(),
        instagram: instagram.trim(),
        faturamento,
        aluna_biteti: alunaBiteti === "Sim" ? `Sim - ${alunaBitetiDetalhe.trim()}` : "Não",
        faz_curso: fazCurso,
        decisao_parceiro: decisaoParceiro,
      });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setError("");
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" /> Qual é o seu nome?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              maxLength={100}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full h-14 rounded-xl border border-border bg-input px-4 text-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5 text-muted-foreground" /> Qual é o seu e-mail?
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              maxLength={255}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full h-14 rounded-xl border border-border bg-input px-4 text-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <Phone className="w-5 h-5 text-muted-foreground" /> Qual é o seu WhatsApp?
            </label>
            <div className="iti-phone-wrapper">
              <input
                ref={phoneInputRef}
                type="tel"
                placeholder="00 00000-0000"
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                className="w-full h-14 rounded-xl border border-border bg-input text-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
                style={{ paddingLeft: "90px" }}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <AtSign className="w-5 h-5 text-muted-foreground" /> Qual é o seu Instagram?
            </label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))}
              placeholder="@seuinstagram"
              maxLength={30}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="w-full h-14 rounded-xl border border-border bg-input px-4 text-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-muted-foreground" /> Qual é o seu faturamento mensal na área da beleza?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                "Até R$ 3.000",
                "R$ 3.000 a R$ 10.000",
                "R$ 10.000 a R$ 30.000",
                "Acima de R$ 30.000",
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setFaturamento(option); }}
                  className={`h-12 rounded-xl border text-sm px-3 transition-all duration-200 ${faturamento === option
                    ? "border-foreground bg-foreground/10 text-foreground font-medium"
                    : "border-border bg-input text-muted-foreground hover:border-foreground/30"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-muted-foreground" /> Você já é aluna da Biteti?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["Sim", "Não"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setAlunaBiteti(option); if (option === "Não") setAlunaBitetiDetalhe(""); }}
                  className={`h-12 rounded-xl border text-sm px-3 transition-all duration-200 ${alunaBiteti === option
                    ? "border-foreground bg-foreground/10 text-foreground font-medium"
                    : "border-border bg-input text-muted-foreground hover:border-foreground/30"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {alunaBiteti === "Sim" && (
              <input
                type="text"
                value={alunaBitetiDetalhe}
                onChange={(e) => setAlunaBitetiDetalhe(e.target.value)}
                placeholder="Qual curso/turma?"
                maxLength={100}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                className="w-full h-14 rounded-xl border border-border bg-input px-4 text-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition-colors"
              />
            )}
          </div>
        );
      case 6:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-muted-foreground" /> Já faz curso online ou presencial?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["Online", "Presencial", "Não faço"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setFazCurso(option); }}
                  className={`h-12 rounded-xl border text-sm px-3 transition-all duration-200 ${fazCurso === option
                    ? "border-foreground bg-foreground/10 text-foreground font-medium"
                    : "border-border bg-input text-muted-foreground hover:border-foreground/30"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-3">
            <label className="text-base font-medium text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" /> A sua decisão de entrar na Mentoria Beauty depende da aprovação do seu parceiro(a)?
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                "Sim, preciso consultar meu parceiro(a)",
                "Não, a decisão é só minha",
                "Decidimos juntos, mas já estamos alinhados",
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setDecisaoParceiro(option); }}
                  className={`h-12 rounded-xl border text-sm px-3 text-left transition-all duration-200 ${decisaoParceiro === option
                    ? "border-foreground bg-foreground/10 text-foreground font-medium"
                    : "border-border bg-input text-muted-foreground hover:border-foreground/30"
                    }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'MADE Outer Sans Light';
          src: url('https://agiovanalara.com.br/wp-content/uploads/2025/08/MADEOuterSans-Light.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
        }

        .iti,
        .iti--allow-dropdown {
          width: 100% !important;
          z-index: 999999999999 !important;
          font-family: 'MADE Outer Sans Light', sans-serif !important;
        }

        .iti__selected-dial-code {
          color: #705336 !important;
          font-size: 16px;
          font-family: 'MADE Outer Sans Light', sans-serif !important;
        }

        .iti__arrow {
          border-top-color: #705336 !important;
        }

        .iti__selected-flag {
          background-color: #FFFFFF05 !important;
          padding: 0 12px !important;
          border: 1px solid #FFFFFF20 !important;
          border-radius: 15px 10px 10px 15px !important;
        }

        .iti__country-list .iti__country-name {
          color: #705336 !important;
        }

        /* Dropdown sempre acima de tudo */
        .iti__country-list {
          z-index: 2147483647 !important;
          position: fixed !important;
          max-height: 200px !important;
          overflow-y: auto !important;
        }

        .iti-phone-wrapper {
          position: relative;
          width: 100%;
        }
      `}</style>

      <div className="w-full">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-foreground" : "bg-border"
                }`}
            />
          ))}
        </div>

        {/* Step content with arrows */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            {renderStep()}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>

          {/* Navigation arrows stacked vertically */}
          <div className="shrink-0 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className={`w-9 h-9 rounded-full border border-border flex items-center justify-center transition-all duration-200 ${step === 0
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-muted cursor-pointer"
                }`}
            >
              <ChevronLeft className="w-4 h-4 text-foreground rotate-90" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 rotate-90" />
            </button>
          </div>
        </div>

        {/* Botão Próximo abaixo do campo */}
        <button
          type="button"
          onClick={handleNext}
          className="w-full h-12 mt-4 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          {step < totalSteps - 1 ? "Próximo" : "Agendar"}
        </button>

        {/* Confirmação de faturamento */}
        <Dialog open={showFaturamentoConfirm} onOpenChange={setShowFaturamentoConfirm}>
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Confirmação de faturamento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Você realmente fatura <strong className="text-foreground">{faturamento}</strong> ou esse valor está próximo do seu faturamento atual?
            </p>
            <DialogFooter className="flex-row gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowFaturamentoConfirm(false);
                  setFaturamento("");
                }}
              >
                Não, alterar
              </Button>
              <Button
                className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => {
                  setShowFaturamentoConfirm(false);
                  setStep(step + 1);
                  setError("");
                }}
              >
                Sim, confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ContactForm;
