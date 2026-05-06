import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Clock, Send, Lightbulb, ChevronDown, ChevronUp, Lock, Loader2, ChevronDown as LangDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTPDetail, useSubmitTP, useRunCode, useHint } from "@/hooks/useTP";
import { useChat } from "@/hooks/useChat";
import { useNotifications } from "@/context/NotificationContext";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";

const LANGUAGES = [
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript" },
  { label: "C++", value: "cpp" },
  { label: "R", value: "r" },
];

function detectLanguage(tags: string[], domaine?: string | null): string {
  const combined = [...(tags || []), domaine ?? ""].join(" ").toLowerCase();
  if (combined.includes("java") && !combined.includes("javascript")) return "java";
  if (combined.includes("javascript") || combined.includes("js")) return "javascript";
  if (combined.includes("c++") || combined.includes("cpp")) return "cpp";
  if (combined.includes(" r ") || combined.includes("r-")) return "r";
  return "python";
}

const TPSessionPage = () => {
  const navigate = useNavigate();
  const { id: tpId } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();

  const { data: tpDetail, isLoading: tpLoading } = useTPDetail(tpId ?? null);
  const { submit, isSubmitting } = useSubmitTP();
  const { runCode, isRunning: isRunningCode } = useRunCode();
  const { requestHint, hint, hintLevel } = useHint(tpId ?? null);
  const { messages, sendMessage, isConnected, isTyping } = useChat(tpId ?? null);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [langOpen, setLangOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalContent, setTerminalContent] = useState<{ stdout: string; stderr: string; exit_code: number } | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [activeAgent, setActiveAgent] = useState<"tuteur" | "explicateur">("tuteur");
  const [timer, setTimer] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tpDetail?.starter_code) {
      setCode(tpDetail.starter_code);
    }
  }, [tpDetail?.starter_code]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleRunCode = async () => {
    if (!tpId || !code.trim()) return;
    setTerminalOpen(true);
    setTerminalContent(null);
    try {
      const result = await runCode({ tpId, code, language });
      setTerminalContent({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
      });
      if (!result.runtime_available) {
        toast.error(result.stderr);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'exécution");
      setTerminalContent({ stdout: "", stderr: String(err), exit_code: -1 });
    }
  };

  const handleSubmit = async () => {
    if (!tpId || !code.trim()) return;
    try {
      const result = await submit({ tpId, code });
      addNotification({
        title: "Soumission évaluée",
        message: `Score final : ${result.score}%`,
        icon: "📊",
      });
      navigate(`/student/result/${tpId}`, { state: { result } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la soumission");
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !isConnected) return;
    sendMessage(chatInput, activeAgent);
    setChatInput("");
  };

  const handleRequestHint = () => {
    requestHint();
    addNotification({
      title: "Indice débloqué",
      message: `Indice niveau ${hintLevel + 1} disponible`,
      icon: "💡",
    });
  };

  const currentLangLabel = LANGUAGES.find((l) => l.value === language)?.label ?? "Python";

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/student/tps")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-foreground text-sm">
            {tpLoading ? "Chargement..." : tpDetail?.topic_title ?? "Session TP"}
          </span>
          <Badge variant="secondary" className="text-xs">Session active</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timer)}</span>
          </div>
          <Badge className="bg-success/10 text-success border-success/20 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1.5 inline-block" />
            En cours
          </Badge>
          <Button
            className="gradient-primary text-primary-foreground"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Soumettre
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT - Énoncé */}
        <div className="w-[35%] border-r border-border overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            📋 <span className="font-semibold text-foreground">Énoncé</span>
          </div>

          {tpLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-foreground mb-2">{tpDetail?.topic_title ?? "Exercice"}</h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {tpDetail?.enonce ?? ""}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground text-sm mb-2">Informations</h3>
                <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                  <p className="text-muted-foreground">
                    Tests unitaires : <span className="text-foreground font-medium">{tpDetail?.tests_count ?? 0}</span>
                  </p>
                </div>
              </div>

              {/* Hints */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setHintsOpen(!hintsOpen)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Lightbulb className="w-4 h-4 text-warning" /> Besoin d'aide ?
                  </span>
                  {hintsOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {hintsOpen && (
                  <div className="p-3 border-t border-border space-y-2">
                    {hintLevel > 0 && hint && (
                      <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                        <span className="font-medium text-foreground">Indice niveau {hintLevel} :</span>
                        <p className="mt-1 text-muted-foreground text-xs">{hint}</p>
                      </div>
                    )}
                    {hintLevel < 3 && (
                      <button
                        onClick={handleRequestHint}
                        className="w-full text-left p-2.5 rounded-lg text-sm bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">
                          {hintLevel === 0 ? "Niveau 1 — Demander un indice" : `Niveau ${hintLevel + 1} — Indice suivant`}
                        </span>
                        {hintLevel === 0 && (
                          <p className="mt-1 text-xs flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Cliquez pour débloquer
                          </p>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* CENTER - Code Editor */}
        <div className="w-[40%] border-r border-border flex flex-col">
          {/* Editor top bar */}
          <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-card/50">
            <div className="flex items-center gap-2">
              {/* Language selector */}
              <div className="relative">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs text-foreground transition-colors"
                >
                  <span>{currentLangLabel}</span>
                  <LangDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {langOpen && (
                  <div className="absolute left-0 top-8 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[120px]">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => { setLanguage(l.value); setLangOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          language === l.value ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">solution.{language === "python" ? "py" : language === "java" ? "java" : language === "cpp" ? "cpp" : language === "r" ? "R" : "js"}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleRunCode}
              disabled={isRunningCode || isSubmitting}
            >
              {isRunningCode ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              Exécuter
            </Button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
                padding: { top: 8 },
              }}
            />
          </div>

          {/* Terminal */}
          <div className={`border-t border-border bg-card/50 transition-all ${terminalOpen ? "h-40" : "h-8"}`}>
            <button
              onClick={() => setTerminalOpen(!terminalOpen)}
              className="w-full h-8 flex items-center px-3 text-xs text-muted-foreground hover:bg-muted/50"
            >
              Terminal{" "}
              {terminalOpen ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />}
            </button>
            {terminalOpen && (
              <div className={`p-3 font-mono text-xs overflow-y-auto h-32 rounded-b border-t-2 ${
                terminalContent
                  ? terminalContent.exit_code === 0
                    ? "border-success/50"
                    : "border-destructive/50"
                  : "border-border"
              }`}>
                {isRunningCode ? (
                  <span className="text-muted-foreground animate-pulse">Exécution en cours...</span>
                ) : terminalContent ? (
                  <div className="space-y-1">
                    {terminalContent.stdout && (
                      <pre className="text-success whitespace-pre-wrap">{terminalContent.stdout}</pre>
                    )}
                    {terminalContent.stderr && (
                      <pre className="text-destructive whitespace-pre-wrap">{terminalContent.stderr}</pre>
                    )}
                    <p className="text-muted-foreground">Exit: {terminalContent.exit_code}</p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Cliquez sur Exécuter pour voir le résultat</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT - AI Assistant */}
        <div className="w-[25%] flex flex-col">
          <div className="border-b border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-foreground">🤖 Assistant IA</span>
            </div>
            <div className="flex gap-1">
              {(["tuteur", "explicateur"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setActiveAgent(a)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeAgent === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {a === "tuteur" ? "Tuteur" : "Explicateur"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
              {isConnected ? `Agent ${activeAgent} • En ligne` : "Connexion..."}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center p-4">
                Posez votre première question à l'assistant IA
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-2.5 rounded-lg text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && <span className="animate-pulse ml-1">▋</span>}
                </div>
              </div>
            ))}
            {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs">🤖</div>
                <div className="bg-muted rounded-lg p-2.5 flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-3 pb-2 flex gap-1 flex-wrap">
            <button
              onClick={handleRequestHint}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>💡</span> Indice
            </button>
            <button
              onClick={() => sendMessage("Explique-moi ce concept en détail", "explicateur")}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>📖</span> Expliquer
            </button>
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                placeholder={isConnected ? "Posez votre question..." : "Connexion..."}
                disabled={!isConnected}
                className="flex-1 h-9 rounded-lg bg-muted/50 border border-border px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <button
                onClick={handleSendChat}
                disabled={!isConnected || !chatInput.trim()}
                className="w-9 h-9 rounded-lg gradient-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TPSessionPage;
