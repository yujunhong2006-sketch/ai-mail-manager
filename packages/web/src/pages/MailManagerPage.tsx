import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { useAccounts } from "../api/queries";
import "./mail-manager.css";

type Category = "Important" | "Normal" | "Junk" | "Pending";
interface Mail {
  accountId: string;
  gmailMessageId: string;
  accountEmail: string;
  fromEmail: string;
  subject: string | null;
  receivedAt: string;
  category: Category;
  summary: string | null;
  reasoning: string | null;
  suggestedAction: string | null;
  deadline: string | null;
  topic: string;
  completed: boolean;
  draftSubject: string | null;
  draftBody: string | null;
}
interface MailResult {
  items: Mail[];
  truncated: boolean;
}
const categories: Category[] = ["Important", "Normal", "Junk", "Pending"];
const mailKey = (mail: Mail) => mail.accountId + ":" + mail.gmailMessageId;

export function MailManagerPage() {
  const [account, setAccount] = useState("");
  const [category, setCategory] = useState<Category>("Important");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const accounts = useAccounts();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["mail-manager", account],
    queryFn: () => apiFetch<MailResult>({ path: "/manager", query: { account } }),
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: ({ mail, action, body }: { mail: Mail; action: string; body?: unknown }) =>
      apiFetch({
        path:
          "/manager/" +
          encodeURIComponent(mail.accountId) +
          "/" +
          encodeURIComponent(mail.gmailMessageId) +
          "/" +
          action,
        method: "POST",
        body,
      }),
    onSuccess: async (_, variables) => {
      setNotice(
        variables.action === "draft"
          ? "Reply draft saved in this app. Review it below; nothing was sent."
          : "Saved.",
      );
      await client.invalidateQueries({ queryKey: ["mail-manager"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const items = query.data?.items ?? [];
  const visible = items.filter((m) => m.category === category);
  const actions = visible
    .filter((m) => !m.completed)
    .toSorted((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const normal = items.filter((m) => m.category === "Normal");
  const topics = [...new Set(normal.map((m) => m.topic))];
  const change = (mail: Mail, next: Category) =>
    mutation.mutate({ mail, action: "update", body: { category: next } });

  return (
    <main className="mail-manager">
      <header className="manager-header">
        <div>
          <p className="manager-eyebrow">YOUR MAIL, AT A GLANCE</p>
          <h1>邮件工作台</h1>
          <p>Focus on what needs you. Review everything else in a summary.</p>
        </div>
        <label>
          Mailbox
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All Gmail accounts</option>
            {accounts.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </label>
      </header>
      {import.meta.env.VITE_LOCAL_WORKBENCH === "true" && <p className="manager-note">本机运行 · <a href="/setup">连接 Gmail / 首次设置</a> · <a href="/app/settings">AI 设置</a></p>}
      <p className="manager-note">Local quarantine · Saved reply drafts · No automatic sending</p>
      <div className="manager-tabs" aria-label="Mail categories">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            <span>{c === "Junk" ? "Junk / Quarantine" : c}</span>
            <strong>{items.filter((m) => m.category === c).length}</strong>
          </button>
        ))}
      </div>
      {query.isLoading && <output>Loading mail…</output>}
      {query.error && (
        <p role="alert">
          {query.error.message} <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {query.data?.truncated && (
        <output>
          Showing the latest 500 stored messages. Select an account to narrow the view; counts and
          summaries cover this selection only.
        </output>
      )}
      {notice && <output>{notice}</output>}
      {category === "Important" && (
        <section>
          <h2>Action List</h2>
          <p>
            {actions.length} open · {visible.length - actions.length} completed
          </p>
          {actions.map((m) => (
            <article className="manager-action" key={mailKey(m)}>
              <input
                aria-label={"Complete action: " + (m.subject ?? "Untitled")}
                type="checkbox"
                checked={m.completed}
                disabled={mutation.isPending}
                onChange={() =>
                  mutation.mutate({ mail: m, action: "update", body: { completed: true } })
                }
              />
              <div>
                <button className="manager-text-button" onClick={() => setExpanded(mailKey(m))}>
                  {m.suggestedAction || "Review: " + (m.subject ?? "Untitled")}
                </button>
                <p>
                  {m.accountEmail} · {m.fromEmail}
                </p>
              </div>
              <span>{m.deadline ? "Due " + m.deadline : "No confirmed deadline"}</span>
            </article>
          ))}
        </section>
      )}
      {category === "Normal" && (
        <section>
          <h2>Normal mail summary</h2>
          <p>AI summaries grouped by topic across the selected mailboxes.</p>
          <div className="manager-digest">
            {topics.map((topic) => (
              <article key={topic}>
                <h3>
                  {topic} · {normal.filter((m) => m.topic === topic).length}
                </h3>
                <ul>
                  {normal
                    .filter((m) => m.topic === topic)
                    .map((m) => (
                      <li key={mailKey(m)}>
                        <button
                          className="manager-text-button"
                          onClick={() => setExpanded(mailKey(m))}
                        >
                          {m.summary || "Summary unavailable"}
                        </button>
                        <small>
                          {m.fromEmail} · {m.accountEmail}
                        </small>
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}
      {category === "Junk" && (
        <p className="manager-note">
          These messages are quarantined in this app. Gmail originals remain untouched. There is no
          automatic expiry or permanent deletion. Restore any message to Normal or Important below.
        </p>
      )}
      {category === "Pending" && (
        <p>
          Mail without the new analysis appears here. Use Analyze to classify existing mail, or use
          the mailbox sync controls for new mail.
        </p>
      )}
      {!query.isLoading && !query.error && visible.length === 0 && (
        <p className="manager-empty">No {category.toLowerCase()} messages in this selection.</p>
      )}
      <section aria-label="Messages">
        {visible.map((m) => (
          <article className="manager-mail" key={mailKey(m)}>
            <div className="manager-mail-heading">
              <button
                className="manager-text-button"
                aria-expanded={expanded === mailKey(m)}
                onClick={() => setExpanded(expanded === mailKey(m) ? null : mailKey(m))}
              >
                <h3>{m.subject || "(No subject)"}</h3>
              </button>
              <span>{new Date(m.receivedAt).toLocaleDateString()}</span>
            </div>
            <p className="manager-meta">
              {m.fromEmail} → {m.accountEmail}
            </p>
            <p>{m.summary || "Not analyzed yet."}</p>
            {expanded === mailKey(m) && (
              <div className="manager-details">
                <dl>
                  <dt>Why this category</dt>
                  <dd>{m.reasoning || "Not analyzed"}</dd>
                  <dt>Suggested action</dt>
                  <dd>{m.suggestedAction || "No action identified"}</dd>
                  <dt>Deadline</dt>
                  <dd>{m.deadline || "No confirmed deadline"}</dd>
                </dl>
                <div className="manager-controls">
                  <Link
                    to={
                      "/account/" +
                      m.accountId +
                      "/messages/" +
                      encodeURIComponent(m.gmailMessageId)
                    }
                  >
                    Open original detail
                  </Link>
                  <button
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ mail: m, action: "analyze" })}
                  >
                    {m.category === "Pending" ? "Analyze" : "Refresh analysis"}
                  </button>
                  {m.category !== "Pending" && (
                    <>
                      <label>
                        Move to
                        <select
                          disabled={mutation.isPending}
                          value={m.category}
                          onChange={(e) => change(m, e.target.value as Category)}
                        >
                          {categories
                            .filter((c) => c !== "Pending")
                            .map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ mail: m, action: "draft" })}
                      >
                        Generate reply draft
                      </button>
                      {m.completed && (
                        <button
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              mail: m,
                              action: "update",
                              body: { completed: false },
                            })
                          }
                        >
                          Reopen action
                        </button>
                      )}
                    </>
                  )}
                </div>
                {m.draftBody && (
                  <section>
                    <h4>Saved reply draft</h4>
                    <p>{m.draftSubject}</p>
                    <textarea
                      aria-label="Saved reply draft"
                      readOnly
                      value={m.draftBody}
                      rows={8}
                    />
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(m.draftBody!).then(
                          () => setNotice("Draft copied."),
                          () =>
                            setNotice("Copy unavailable. Select the draft text and copy manually."),
                        );
                      }}
                    >
                      Copy draft
                    </button>
                    <p>Stored in this app. Review and paste into Gmail when ready.</p>
                  </section>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
