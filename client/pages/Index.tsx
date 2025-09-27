import React, { useEffect, useRef, useState } from "react";
import { DemoResponse } from "@shared/api";
import {
  apiGet,
  extractLabels,
  listTranscripts,
  getTranscript,
} from "../lib/api";

type Message = { role: "user" | "assistant"; text: string };

const defaultStopwords: string[] = [
  "the",
  "and",
  "to",
  "a",
  "of",
  "in",
  "for",
  "is",
  "that",
  "on",
  "you",
  "it",
  "with",
  "as",
  "are",
  "this",
  "be",
  "or",
  "we",
  "i",
];

function cleanTranscript(text: string) {
  if (!text) return "";
  let out = text.replace(/\s+/g, " ").trim();
  out = out.replace(/\b(um+|uh+|like|you know|I mean)\b/gi, "");
  out = out.replace(/\b\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4}\b/g, "[phone]");
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  return out.trim();
}

// Small inline component for adding subtasks
function AddSubtask({ onAdd }: { onAdd: (t: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="New subtask"
        className="flex-1 rounded border p-2 text-sm"
      />
      <button
        onClick={() => {
          if (val.trim()) {
            onAdd(val.trim());
            setVal("");
          }
        }}
        className="px-3 py-2 rounded bg-primary text-white"
      >
        Add
      </button>
    </div>
  );
}

export default function Index() {
  const [exampleFromServer, setExampleFromServer] = useState("");
  const [activePage, setActivePage] = useState<
    "dashboard" | "ai" | "crm" | "tasks" | "notes"
  >("ai");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [aiStarted, setAiStarted] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [linkedClient, setLinkedClient] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Welcome — upload a transcript to get started or ask a question.",
    },
  ]);

  const [tasks, setTasks] = useState<string[]>([]);
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [availableTranscripts, setAvailableTranscripts] = useState<string[]>(
    [],
  );
  const [lastExtractResponse, setLastExtractResponse] = useState<any | null>(
    null,
  );

  useEffect(() => {
    // fetch demo message
    apiGet("/api/demo")
      .then((d: DemoResponse) => setExampleFromServer(d.message))
      .catch(() => {});

    // fetch available transcripts from backend
    listTranscripts()
      .then((r) => setAvailableTranscripts(r.transcripts || []))
      .catch(() => {});
  }, []);

  const handleExtractTasks = async () => {
    if (!transcript) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "No transcript to extract." },
      ]);
      return;
    }
    setLoading(true);
    try {
      const res = await extractLabels(transcript);
      setLastExtractResponse(res);
      // normalize response into task strings for the context panel
      let newTasks: string[] = [];
      if (!res) {
        newTasks = ["No labels returned"];
      } else if (Array.isArray(res)) {
        newTasks = res.map(
          (r: any, i: number) =>
            `${r.task_type || "task"}${r.parameters ? ": " + JSON.stringify(r.parameters) : ""}`,
        );
      } else if (res.assigned_tasks) {
        newTasks = (res.assigned_tasks || []).map(
          (t: any) =>
            `${t.task_type || t.task_name || "task"}${t.parameters ? ": " + JSON.stringify(t.parameters) : ""}`,
        );
      } else {
        newTasks = [JSON.stringify(res)];
      }
      setTasks(newTasks);
      setSelectedTaskIndexes([]);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Extraction complete." },
      ]);
    } catch (e: any) {
      console.error("extract error", e);
      // store detailed error for user inspection
      setLastExtractResponse({
        error: e && e.attempts ? e.attempts : null,
        message: e?.message || String(e),
      });

      // fallback to local heuristic extraction
      const samples = [
        "Follow up with client about portfolio rebalancing",
        "Prepare Q3 performance summary for review",
        "Schedule meeting to discuss risk tolerance updates",
      ];
      const lines = (transcript || "")
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      const found: string[] = [];
      for (const l of lines) {
        if (/todo|follow up|action|follow-up|deadline|assign/i.test(l))
          found.push(l);
      }
      const local = found.length ? found : samples;
      setTasks(local);
      setSelectedTaskIndexes([]);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Extraction failed — used local fallback. See Raw Extract Response for details.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refreshTranscripts = async () => {
    try {
      const r = await listTranscripts();
      setAvailableTranscripts(r.transcripts || []);
    } catch (e) {
      // ignore
    }
  };

  const handleLoadTranscript = async (filename: string) => {
    setLoading(true);
    try {
      const r = await getTranscript(filename);
      setTranscript(r.transcript || "");
      setUploadedFileName(filename);
      setAiStarted(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Loaded transcript: " + filename },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Failed to load transcript." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Clients
  const initialClients = [
    {
      id: "1",
      name: "Anna Völkner",
      aum: "€12.4M",
      email: "anna@bank.com",
      code: "CH-00123",
      segment: "HNW",
      preferredContact: "Email",
      lastContact: "2025-09-26",
      portfolio: "Multi-asset; equities overweight.",
      advisorNotes: "Internal preferences & notes...",
      risk: "Medium Risk",
    },
    {
      id: "2",
      name: "Michael Zhang",
      aum: "€3.2M",
      email: "michael@wealth.com",
      code: "CH-00456",
      segment: "HNWI",
      preferredContact: "Phone",
      lastContact: "2025-08-11",
      portfolio: "Fixed income focus.",
      advisorNotes: "",
      risk: "Medium Risk",
    },
    {
      id: "3",
      name: "Sofia Rossi",
      aum: "€7.8M",
      email: "sofia@capital.com",
      code: "CH-00789",
      segment: "HNW",
      preferredContact: "Email",
      lastContact: "2025-07-20",
      portfolio: "Equities; growth bias.",
      advisorNotes: "",
      risk: "Medium Risk",
    },
  ];

  const [clientList, setClientList] = useState(initialClients);
  const linkedClientObj = clientList.find((c) => c.id === linkedClient) || null;

  const [pendingTaskNotes, setPendingTaskNotes] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const noteText = linkedClientObj ? linkedClientObj.advisorNotes : notes;
    if (!noteText) return;
    if (!selectedTaskIndexes.length) return;

    // Apply to existing kanban cards that match task titles
    setKanban((prev) => {
      const copy: any = { ...prev };
      let changed = false;
      for (const col of Object.keys(copy)) {
        copy[col] = copy[col].map((card: any) => {
          for (const idx of selectedTaskIndexes) {
            const t = tasks[idx];
            if (!t) continue;
            if (card.title === t) {
              if (!card.details || !card.details.includes("Advisor note:")) {
                changed = true;
                return {
                  ...card,
                  details:
                    (card.details ? card.details + "\n\n" : "") +
                    "Advisor note: " +
                    noteText,
                };
              }
            }
          }
          return card;
        });
      }
      return changed ? copy : prev;
    });

    // Store pending notes for tasks not yet in kanban
    setPendingTaskNotes((prev) => {
      const p = { ...prev };
      selectedTaskIndexes.forEach((idx) => {
        const t = tasks[idx];
        if (t) p[t] = noteText;
      });
      return p;
    });
  }, [linkedClientObj?.advisorNotes, notes, selectedTaskIndexes]);

  // Kanban
  const [kanban, setKanban] = useState<any>({
    todo: [
      {
        id: "t1",
        title: "Onboard new client: Rossi",
        client: "Sofia Rossi",
        details: "Collect KYC and signed docs.",
        assignee: "Anna",
        created: "2025-09-01",
        subtasks: [{ id: "s1", title: "Send docs", done: false }],
      },
    ],
    inprogress: [
      {
        id: "t2",
        title: "Review risk profile: Zhang",
        client: "Michael Zhang",
        details: "Assess risk questionnaire vs portfolio.",
        assignee: "Michael",
        created: "2025-09-02",
        subtasks: [],
      },
    ],
    review: [],
    done: [],
  });

  const [dragging, setDragging] = useState<{ id: string; from: string } | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCard, setModalCard] = useState<any | null>(null);
  const [modalColumn, setModalColumn] = useState<string | null>(null);

  const columnMap: Record<string, string> = {
    "To Do": "todo",
    "In Progress": "inprogress",
    "In Review": "review",
    Done: "done",
  };

  const onDragStartCard = (e: React.DragEvent, card: any, from: string) => {
    setDragging({ id: card.id, from });
    try {
      e.dataTransfer.setData("text/plain", card.id);
    } catch {}
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOverColumn = (e: React.DragEvent) => e.preventDefault();
  const onDropToColumn = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const newKanban: any = { ...kanban };
    let moved: any = null;
    for (const k of Object.keys(newKanban)) {
      const idx = newKanban[k].findIndex((c: any) => c.id === id);
      if (idx > -1) {
        moved = newKanban[k].splice(idx, 1)[0];
        break;
      }
    }
    if (moved) {
      newKanban[colKey].unshift(moved);
      setKanban(newKanban);
    }
    setDragging(null);
  };

  const openCardModal = (card: any, colKey: string) => {
    setModalCard({
      ...card,
      subtasks: card.subtasks ? [...card.subtasks] : [],
    });
    setModalColumn(colKey);
    setModalOpen(true);
  };
  const closeCardModal = () => {
    setModalCard(null);
    setModalColumn(null);
    setModalOpen(false);
  };

  const toggleSubtask = (id: string) => {
    if (!modalCard) return;
    setModalCard((m: any) => ({
      ...m,
      subtasks: m.subtasks.map((s: any) =>
        s.id === id ? { ...s, done: !s.done } : s,
      ),
    }));
  };
  const removeSubtask = (id: string) => {
    if (!modalCard) return;
    setModalCard((m: any) => ({
      ...m,
      subtasks: m.subtasks.filter((s: any) => s.id !== id),
    }));
  };
  const addSubtaskToModal = (title: string) => {
    if (!modalCard) return;
    const id = `st_${Date.now()}`;
    setModalCard((m: any) => ({
      ...m,
      subtasks: [...(m.subtasks || []), { id, title, done: false }],
    }));
  };

  const saveModalCard = () => {
    if (!modalCard || !modalColumn) return;
    setKanban((prev: any) => {
      const copy = { ...prev };
      const idx = copy[modalColumn].findIndex(
        (c: any) => c.id === modalCard.id,
      );
      if (idx > -1) copy[modalColumn][idx] = modalCard;
      return copy;
    });
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "Card updated." },
    ]);
    closeCardModal();
  };

  // AI functions
  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setTranscript(text);
      setUploadedFileName(file.name);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `File uploaded: ${file.name}` },
      ]);
      setAiStarted(true);
    };
    reader.readAsText(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const handleAddTasksToBoard = () => {
    if (!tasks.length) return;
    if (!selectedTaskIndexes.length) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Select one or more tasks to add to the Task Board.",
        },
      ]);
      return;
    }
    const uniq = Array.from(new Set(selectedTaskIndexes)).sort((a, b) => a - b);
    const toAdd = uniq.map((i) => tasks[i]).filter(Boolean);
    if (!toAdd.length) return;
    const newTasks = toAdd.map((t, i) => ({
      id: `kb_${Date.now()}_${i}`,
      title: t,
      client: linkedClientObj?.name || "Internal",
      details: pendingTaskNotes[t]
        ? t + "\n\nAdvisor note: " + pendingTaskNotes[t]
        : t,
      assignee: linkedClientObj?.name || "",
      created: new Date().toISOString().slice(0, 10),
      subtasks: [],
    }));
    setKanban((prev: any) => ({ ...prev, todo: [...newTasks, ...prev.todo] }));
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `Added ${newTasks.length} selected task(s) to Task Board.`,
      },
    ]);
    setTasks((prev) => prev.filter((_, idx) => !uniq.includes(idx)));
    // remove pending notes for added tasks
    setPendingTaskNotes((prev) => {
      const copy = { ...prev };
      toAdd.forEach((t) => delete copy[t]);
      return copy;
    });
    setSelectedTaskIndexes([]);
    setActivePage("tasks");
  };

  const handleSummarize = () => {
    const summary = transcript
      ? transcript.split(/\n+/).slice(0, 3).join(" ").slice(0, 400)
      : "No transcript to summarize.";
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `Summary: ${summary}` },
    ]);
  };

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Please add feedback before submitting." },
      ]);
      return;
    }
    console.log("Feedback submitted:", {
      file: uploadedFileName,
      client: linkedClientObj?.id,
      feedback,
    });
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "Feedback submitted. Thank you." },
    ]);
    setFeedback("");
  };

  // Profile menu
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "You have been logged out." },
    ]);
    setProfileOpen(false);
    setActivePage("dashboard");
  };
  const handleOpenSettings = () => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "Settings panel opened (placeholder)." },
    ]);
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card">
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="p-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="text-sm font-semibold">
          Cortexly<span className="text-primary">.ai</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">Anna V.</div>
        </div>
      </div>

      <div className="container mx-auto py-6">
        <div className="relative">
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Sidebar */}
            <aside
              className={`col-span-12 md:col-span-3 bg-card border-r border-border p-4 self-start`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded flex items-center justify-center bg-primary text-primary-foreground font-bold">
                  C
                </div>
                <div>
                  <div className="text-base font-bold">
                    Cortexly
                    <span className="text-primary font-normal">.ai</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    AI-Powered Assistant
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden ml-auto p-1"
                  aria-label="Close sidebar"
                >
                  ✕
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setActivePage("dashboard")}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${activePage === "dashboard" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/5"}`}
                >
                  <span className="text-sm">Dashboard</span>
                </button>

                <button
                  onClick={() => setActivePage("ai")}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${activePage === "ai" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/5"}`}
                >
                  <span className="text-sm">Text Extraction</span>
                </button>

                <button
                  onClick={() => setActivePage("tasks")}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${activePage === "tasks" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/5"}`}
                >
                  <span className="text-sm">Task Management</span>
                </button>

                <button
                  onClick={() => setActivePage("crm")}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${activePage === "crm" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/5"}`}
                >
                  <span className="text-sm">CRM</span>
                </button>

                <button
                  onClick={() => setActivePage("notes")}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${activePage === "notes" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/5"}`}
                >
                  <span className="text-sm">Notes Page</span>
                </button>
              </nav>
            </aside>

            {/* Main content area */}
            <div className="col-span-12 md:col-span-9">
              <header className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold">
                    {activePage === "dashboard"
                      ? "Dashboard"
                      : activePage === "ai"
                        ? "Text Extraction"
                        : activePage === "crm"
                          ? "CRM"
                          : activePage === "tasks"
                            ? "Task Management"
                            : "Notes"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      if (activePage === "dashboard")
                        return "Overview of key metrics and recent activity for a quick operational snapshot.";
                      if (activePage === "ai")
                        return "Upload transcripts or documents to extract tasks, summaries, and key topics using the AI assistant.";
                      if (activePage === "crm")
                        return "Manage client profiles, view assets and contact history, and act on client-specific insights.";
                      if (activePage === "tasks")
                        return "Organize and track work with a Kanban board; drag tasks across stages and inspect details.";
                      return "Take notes, organize information, and use the Copilot for writing and summarization.";
                    })()}
                  </p>
                </div>

                <div className="relative" ref={profileRef as any}>
                  <button
                    onClick={() => setProfileOpen((p) => !p)}
                    className="flex items-center gap-3"
                  >
                    <div className="text-right">
                      <div className="text-sm font-medium">Anna Völkner</div>
                      <div className="text-xs text-muted-foreground">
                        Investment Advisor
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      AV
                    </div>
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded shadow z-40">
                      <button
                        onClick={handleOpenSettings}
                        className="w-full text-left px-3 py-2 hover:bg-muted/5"
                      >
                        Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 hover:bg-muted/5"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </header>

              <main>
                {/* Dashboard */}
                {activePage === "dashboard" && (
                  <section
                    id="dashboard"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                  >
                    <div className="col-span-2 space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          {
                            title: "New Tasks",
                            value: kanban?.todo?.length || 0,
                          },
                          {
                            title: "Pending",
                            value: kanban?.inprogress?.length || 0,
                          },
                          {
                            title: "Due Today",
                            value: (() => {
                              const today = new Date()
                                .toISOString()
                                .slice(0, 10);
                              let count = 0;
                              ["todo", "inprogress", "review", "done"].forEach(
                                (col) => {
                                  (kanban?.[col] || []).forEach((c: any) => {
                                    if (c && c.created === today) count++;
                                  });
                                },
                              );
                              return count;
                            })(),
                          },
                          {
                            title: "Overdue",
                            value: (() => {
                              const today = new Date();
                              const cutoff = new Date(today);
                              cutoff.setDate(cutoff.getDate() - 7); // consider tasks older than 7 days as overdue
                              const cutoffStr = cutoff
                                .toISOString()
                                .slice(0, 10);
                              let count = 0;
                              ["todo", "inprogress", "review"].forEach(
                                (col) => {
                                  (kanban?.[col] || []).forEach((c: any) => {
                                    if (c && c.created && c.created < cutoffStr)
                                      count++;
                                  });
                                },
                              );
                              return count;
                            })(),
                          },
                        ].map((k) => (
                          <div
                            key={k.title}
                            className="rounded-lg border border-border p-4 bg-card"
                          >
                            <div className="text-sm text-muted-foreground">
                              {k.title}
                            </div>
                            <div className="text-2xl font-semibold mt-2">
                              {k.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-border p-6 bg-card">
                        <div className="text-sm text-muted-foreground">
                          Frequent Clients
                        </div>
                        <div className="mt-4 grid gap-3">
                          {clientList.slice(0, 3).map((c) => (
                            <div
                              key={c.name}
                              className="flex items-center gap-3"
                            >
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                {c.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div className="text-sm">{c.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* AI Assistant / Text Extraction */}
                {activePage === "ai" && (
                  <section
                    id="ai-assistant"
                    className="grid grid-cols-1 lg:grid-cols-5 gap-6"
                  >
                    <div className="lg:col-span-3 space-y-6">
                      {!aiStarted ? (
                        <div
                          id="ai-start-screen"
                          className="rounded-lg border border-border p-8 bg-card text-center"
                        >
                          <h2 className="text-xl font-semibold">
                            Text Extraction
                          </h2>
                          <p className="mt-2 text-muted-foreground">
                            Upload meeting notes or paste a transcript to
                            extract tasks, summaries and key topics.
                          </p>
                          <div className="mt-6 flex items-center justify-center gap-3">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 rounded bg-primary text-white"
                            >
                              Upload a File
                            </button>
                            <button
                              onClick={() => {
                                setTranscript(
                                  "Client: Please follow up on investment policy.\nTODO: Send updated proposal.",
                                );
                                setAiStarted(true);
                                setUploadedFileName("meeting_notes.txt");
                              }}
                              className="px-4 py-2 rounded border"
                            >
                              Use Example
                            </button>
                            <button
                              onClick={refreshTranscripts}
                              className="px-4 py-2 rounded border"
                            >
                              Refresh List
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".txt"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </div>

                          {availableTranscripts.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm text-muted-foreground">
                                Available Transcripts
                              </div>
                              <div className="mt-2 space-y-2">
                                {availableTranscripts.slice(0, 10).map((f) => (
                                  <div
                                    key={f}
                                    className="flex items-center justify-between p-2 border rounded"
                                  >
                                    <div className="text-sm">{f}</div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleLoadTranscript(f)}
                                        className="px-2 py-1 rounded border text-sm"
                                      >
                                        Load
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {loading && (
                            <div className="mt-3 text-sm text-muted-foreground">
                              Loading...
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          id="ai-chat-flow"
                          className="rounded-lg border border-border p-4 bg-card"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"></div>
                              <div>
                                <div className="text-sm font-medium">
                                  {uploadedFileName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {linkedClientObj
                                    ? linkedClientObj.name
                                    : "Link to Client..."}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={linkedClient || ""}
                                onChange={(e) =>
                                  setLinkedClient(e.target.value || null)
                                }
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="">Link to Client...</option>
                                {clientList.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                id="cancel-upload-btn"
                                onClick={() => {
                                  setAiStarted(false);
                                  setUploadedFileName(null);
                                  setLinkedClient(null);
                                  setTranscript("");
                                }}
                                className="text-sm text-muted-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 h-64 overflow-auto bg-white p-3 rounded">
                            {messages.map((m, i) => (
                              <div
                                key={i}
                                className={`mb-3 ${m.role === "assistant" ? "text-sm text-muted-foreground" : "text-sm text-foreground"}`}
                              >
                                <div
                                  className={`${m.role === "assistant" ? "bg-muted/10 p-3 rounded" : "bg-primary/5 p-3 rounded"}`}
                                >
                                  {m.text}
                                </div>
                              </div>
                            ))}
                          </div>

                          <input
                            placeholder="Ask a question or give a command..."
                            className="flex-1 min-w-0 border border-border rounded-md px-3 py-2 bg-transparent h-10"
                          />

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-none h-10 px-3 rounded-md border border-border text-muted-foreground"
                              >
                                Attach
                              </button>
                              <button
                                onClick={handleExtractTasks}
                                id="extract-tasks-btn"
                                className="flex-none h-10 px-4 rounded-md bg-primary text-white"
                              >
                                Extract Tasks
                              </button>
                              <button
                                onClick={handleSummarize}
                                className="flex-none h-10 px-3 rounded-md border border-border text-muted-foreground"
                              >
                                Summarize
                              </button>
                            </div>
                          </div>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </div>
                      )}

                      <div className="rounded-lg border border-border p-6 bg-card">
                        <h3 className="font-semibold">Raw transcript</h3>
                        <textarea
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          className="mt-2 w-full min-h-[120px] bg-transparent resize-none outline-none"
                          placeholder="Transcript text..."
                        />
                      </div>

                      <div className="rounded-lg border border-border p-6 bg-card mt-4">
                        <h3 className="font-semibold">
                          Cleaned transcript (highlighted)
                        </h3>
                        <div className="mt-2 p-4 bg-white rounded min-h-[80px] text-sm leading-relaxed">
                          {cleanTranscript(transcript) || (
                            <span className="text-muted-foreground">
                              No transcript available
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border p-6 bg-card mt-4">
                        <h3 className="font-semibold">Feedback to model</h3>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Mark labels that should be <strong>positive</strong>{" "}
                          but were missed (improves recall).
                        </div>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          className="mt-3 w-full min-h-[100px] rounded border p-3 text-sm"
                          placeholder="Optional notes..."
                        />
                        <div className="mt-3">
                          <button
                            onClick={handleSubmitFeedback}
                            className="px-3 py-2 rounded border"
                          >
                            Submit feedback
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Context panel column (shows summary/stats/tasks) */}
                    <aside
                      id="context-panel"
                      className="col-span-1 lg:col-span-2"
                    >
                      <div className="rounded-lg border border-border p-4 bg-card sticky top-6 h-[calc(100vh-140px)] overflow-auto">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Context Panel</h4>
                          <button
                            onClick={() => {
                              setTasks([]);
                              setSelectedTaskIndexes([]);
                            }}
                            className="text-xs text-muted-foreground"
                          >
                            Clear
                          </button>
                        </div>

                        <div className="relative">
                          <div className="mt-3 text-sm text-muted-foreground">
                            CONTEXT
                          </div>
                          <div className="mt-2">
                            {uploadedFileName ? (
                              <div className="p-3 rounded bg-muted/5">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="text-sm font-medium">
                                      {uploadedFileName}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {linkedClientObj
                                        ? linkedClientObj.name
                                        : "No client linked"}
                                    </div>
                                  </div>
                                  {linkedClientObj && (
                                    <div className="ml-3">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border text-sm">
                                        {linkedClientObj.risk || "Medium Risk"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {linkedClientObj && (
                                  <div className="mt-3 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">
                                        ID:
                                      </span>{" "}
                                      {linkedClientObj.code}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Segment:
                                      </span>{" "}
                                      {linkedClientObj.segment}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Preferred contact:
                                      </span>{" "}
                                      {linkedClientObj.preferredContact} •{" "}
                                      <span className="text-muted-foreground">
                                        Last:
                                      </span>{" "}
                                      {linkedClientObj.lastContact}
                                    </div>
                                    <div className="mt-2">
                                      <span className="text-muted-foreground">
                                        Portfolio:
                                      </span>{" "}
                                      {linkedClientObj.portfolio}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No file uploaded
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 text-sm text-muted-foreground">
                          TASKS ({tasks.length})
                        </div>
                        <div className="mt-2">
                          {tasks.length ? (
                            <>
                              {tasks.map((t, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-3 mt-2 p-3 border rounded bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-5 w-5"
                                    checked={selectedTaskIndexes.includes(idx)}
                                    onChange={() => {
                                      setSelectedTaskIndexes((prev) =>
                                        prev.includes(idx)
                                          ? prev.filter((i) => i !== idx)
                                          : [...prev, idx],
                                      );
                                    }}
                                  />
                                  <div className="text-sm leading-snug">
                                    {t}
                                  </div>
                                </div>
                              ))}

                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={handleAddTasksToBoard}
                                  className="flex-1 px-3 py-2 rounded bg-primary text-white"
                                >
                                  Add to Task Board
                                </button>
                                <button
                                  onClick={() => {
                                    setTasks([]);
                                    setSelectedTaskIndexes([]);
                                  }}
                                  className="px-3 py-2 rounded border border-border text-muted-foreground"
                                >
                                  Clear
                                </button>
                              </div>

                              {lastExtractResponse && (
                                <div className="mt-4">
                                  <div className="text-sm text-muted-foreground">
                                    Raw Extract Response
                                  </div>
                                  <pre
                                    className="mt-2 p-3 bg-muted/5 rounded text-xs overflow-auto"
                                    style={{ maxHeight: 240 }}
                                  >
                                    {JSON.stringify(
                                      lastExtractResponse,
                                      null,
                                      2,
                                    )}
                                  </pre>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground mt-2">
                              No tasks extracted yet.
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium">
                            ADVISOR NOTES
                          </label>
                          {linkedClientObj ? (
                            <textarea
                              value={linkedClientObj.advisorNotes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setClientList((prev) =>
                                  prev.map((c) =>
                                    c.id === linkedClientObj.id
                                      ? { ...c, advisorNotes: val }
                                      : c,
                                  ),
                                );
                              }}
                              className="mt-2 w-full min-h-[120px] rounded border p-3 text-sm"
                              placeholder="Internal preferences & notes..."
                            />
                          ) : (
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              className="mt-2 w-full min-h-[120px] rounded border p-3 text-sm"
                              placeholder="Add your notes..."
                            />
                          )}
                        </div>
                      </div>
                    </aside>
                  </section>
                )}

                {/* Task Management Kanban */}
                {activePage === "tasks" && (
                  <section
                    id="task-management"
                    className="grid grid-cols-1 md:grid-cols-4 gap-4"
                  >
                    {(Object.keys(columnMap) as Array<any>).map((col) => {
                      const colKey = columnMap[col];
                      return (
                        <div
                          key={col}
                          onDragOver={onDragOverColumn}
                          onDrop={(e) => onDropToColumn(e, colKey)}
                          className="rounded-lg border border-border p-4 bg-card min-h-[200px]"
                        >
                          <div className="font-semibold mb-3">{col}</div>
                          <div className="space-y-3">
                            {kanban[colKey].map((card: any) => (
                              <div
                                key={card.id}
                                draggable
                                onDragStart={(e) =>
                                  onDragStartCard(e, card, colKey)
                                }
                                onClick={() => openCardModal(card, colKey)}
                                className="kanban-card p-3 rounded border bg-white cursor-pointer hover:shadow"
                              >
                                <div className="font-medium">{card.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {card.client}
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  {card.assignee
                                    ? `Assignee: ${card.assignee}`
                                    : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Card modal */}
                    {modalOpen && modalCard && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center">
                        <div
                          onClick={closeCardModal}
                          className="absolute inset-0 bg-black/50"
                        />
                        <div className="relative bg-card rounded-lg p-6 z-50 w-[95%] md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-auto">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <input
                                value={modalCard.title}
                                onChange={(e) =>
                                  setModalCard((m: any) => ({
                                    ...m,
                                    title: e.target.value,
                                  }))
                                }
                                className="text-lg font-semibold w-full bg-transparent border-b pb-2"
                              />
                              <div className="mt-2 text-sm text-muted-foreground">
                                Client
                              </div>
                              <select
                                value={modalCard.client}
                                onChange={(e) =>
                                  setModalCard((m: any) => ({
                                    ...m,
                                    client: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded border p-2"
                              >
                                <option value="">Unlinked</option>
                                {clientList.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>

                              <div className="mt-4 text-sm text-muted-foreground">
                                Assignee
                              </div>
                              <input
                                value={modalCard.assignee || ""}
                                onChange={(e) =>
                                  setModalCard((m: any) => ({
                                    ...m,
                                    assignee: e.target.value,
                                  }))
                                }
                                placeholder="Assign to..."
                                className="mt-1 w-full rounded border p-2"
                              />

                              <div className="mt-4 text-sm text-muted-foreground">
                                Description
                              </div>
                              <textarea
                                value={modalCard.details || ""}
                                onChange={(e) =>
                                  setModalCard((m: any) => ({
                                    ...m,
                                    details: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded border p-2 min-h-[120px]"
                              />

                              <div className="mt-4 text-sm text-muted-foreground">
                                Subtasks
                              </div>
                              <div className="mt-2 space-y-2">
                                {(modalCard.subtasks || []).map((s: any) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center gap-2"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={s.done}
                                      onChange={() => toggleSubtask(s.id)}
                                    />
                                    <div
                                      className={`${s.done ? "line-through text-muted-foreground" : ""}`}
                                    >
                                      {s.title}
                                    </div>
                                    <button
                                      onClick={() => removeSubtask(s.id)}
                                      className="text-xs text-muted-foreground ml-auto"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <AddSubtask
                                  onAdd={(t) => addSubtaskToModal(t)}
                                />
                              </div>
                            </div>

                            <div className="w-64">
                              <div className="text-sm text-muted-foreground">
                                Metadata
                              </div>
                              <div className="mt-2 bg-muted/5 rounded p-3">
                                <div className="text-sm">
                                  <strong>Client:</strong> {modalCard.client}
                                </div>
                                <div className="text-sm mt-2">
                                  <strong>Created:</strong>{" "}
                                  {modalCard.created || "—"}
                                </div>
                                <div className="text-sm mt-2">
                                  <strong>ID:</strong> {modalCard.id}
                                </div>
                                <div className="mt-4">
                                  <button
                                    onClick={saveModalCard}
                                    className="w-full px-3 py-2 rounded bg-primary text-white"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={closeCardModal}
                                    className="w-full mt-2 px-3 py-2 rounded border"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* CRM */}
                {activePage === "crm" && (
                  <section
                    id="crm"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                  >
                    <aside className="col-span-1 rounded-lg border border-border p-4 bg-card">
                      <div className="mb-4">
                        <input
                          placeholder="Search clients"
                          className="w-full rounded border p-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        {clientList.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {}}
                            className={`w-full text-left p-2 rounded hover:bg-muted/5`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                  {c.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")}
                                </div>
                                <div className="text-sm">{c.name}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {c.aum}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </aside>

                    <div className="col-span-2 rounded-lg border border-border p-6 bg-card">
                      <div className="text-sm text-muted-foreground">
                        Select a client to see details
                      </div>
                    </div>
                  </section>
                )}

                {/* Notes Page */}
                {activePage === "notes" && (
                  <section
                    id="notes"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                  >
                    <aside className="rounded-lg border border-border p-4 bg-card">
                      <div className="text-sm font-semibold">
                        Cortexly Data Bank
                      </div>
                      <input
                        className="mt-3 w-full rounded border p-2 text-sm"
                        placeholder="Search"
                      />
                    </aside>

                    <div className="col-span-1 lg:col-span-2 rounded-lg border border-border p-6 bg-card prose">
                      <h2 className="text-lg font-semibold">Meeting Notes</h2>
                      <p className="text-sm text-muted-foreground">
                        This is the main note-taking area. Write and format
                        notes here.
                      </p>
                      <div className="mt-4">
                        <textarea
                          className="w-full min-h-[300px] p-3 border rounded"
                          placeholder="Start writing..."
                        />
                      </div>
                    </div>

                    <aside className="rounded-lg border border-border p-4 bg-card">
                      <div className="text-sm font-semibold">Copilot</div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        AI suggestions and quick actions appear here.
                      </div>
                    </aside>
                  </section>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
