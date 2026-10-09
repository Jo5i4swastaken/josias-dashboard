"use client";

import { useMemo, useState } from "react";
import type { Channel, DashboardView, Deadline, StalledItem, UrgentItem, WeekDayView, WeekTask } from "@/lib/types";

type Item = UrgentItem | WeekTask | StalledItem | Channel | Deadline;

async function send(path: string, method: string, body?: unknown): Promise<{ item?: Item }> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; item?: Item };
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Sign in again.");
  }
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function replace<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((entry) => entry.id === item.id)
    ? items.map((entry) => (entry.id === item.id ? item : entry))
    : [...items, item];
}

function dueLabel(dueAt: string, today: string): { text: string; overdue: boolean } {
  if (dueAt < today) {
    return { text: "Overdue", overdue: true };
  }
  if (dueAt === today) {
    return { text: "Today", overdue: false };
  }
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day));
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dueAt === tomorrow.toISOString().slice(0, 10)) {
    return { text: "Tomorrow", overdue: false };
  }
  const [dueYear, dueMonth, dueDay] = dueAt.split("-").map(Number);
  return {
    text: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(dueYear, dueMonth - 1, dueDay)),
    ),
    overdue: false,
  };
}

function sortDeadlines(items: Deadline[]): Deadline[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    return a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title);
  });
}

export function Dashboard({ username, initial }: { username: string; initial: DashboardView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const deadlines = useMemo(() => sortDeadlines(view.deadlines), [view.deadlines]);
  const range = `${view.weekDays[0]?.pretty ?? ""} – ${view.weekDays[6]?.pretty ?? ""}`;

  async function run(key: string, fn: () => Promise<void>): Promise<boolean> {
    setError(null);
    setPending(key);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setPending(null);
    }
  }

  function put(section: "urgent" | "week" | "stalled" | "channels" | "deadlines", item: Item) {
    setView((current) => {
      if (section === "urgent") return { ...current, urgent: replace(current.urgent, item as UrgentItem) };
      if (section === "week") return { ...current, week: replace(current.week, item as WeekTask) };
      if (section === "stalled") return { ...current, stalled: replace(current.stalled, item as StalledItem) };
      if (section === "channels") return { ...current, channels: replace(current.channels, item as Channel) };
      return { ...current, deadlines: replace(current.deadlines, item as Deadline) };
    });
  }

  function remove(section: "urgent" | "week" | "stalled" | "channels" | "deadlines", id: string) {
    setView((current) => {
      if (section === "urgent") return { ...current, urgent: current.urgent.filter((item) => item.id !== id) };
      if (section === "week") return { ...current, week: current.week.filter((item) => item.id !== id) };
      if (section === "stalled") return { ...current, stalled: current.stalled.filter((item) => item.id !== id) };
      if (section === "channels") return { ...current, channels: current.channels.filter((item) => item.id !== id) };
      return { ...current, deadlines: current.deadlines.filter((item) => item.id !== id) };
    });
  }

  async function toggle(section: "urgent" | "week" | "stalled" | "channels" | "deadlines", item: { id: string; done: boolean }) {
    await run(item.id, async () => {
      const data = await send(`/api/dashboard/${section}/${item.id}`, "PATCH", { done: !item.done });
      if (data.item) {
        put(section, data.item);
      }
    });
  }

  async function destroy(section: "urgent" | "week" | "stalled" | "channels" | "deadlines", id: string) {
    if (!window.confirm("Remove this item?")) {
      return;
    }
    await run(id, async () => {
      await send(`/api/dashboard/${section}/${id}`, "DELETE");
      remove(section, id);
    });
  }

  return (
    <main className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Week of {range}</p>
          <h1>Josias</h1>
          <p className="who">Signed in as {username}</p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            void run("logout", async () => {
              await send("/api/auth/logout", "POST");
              window.location.assign("/login");
            });
          }}
        >
          Sign out
        </button>
      </header>

      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="stack">
        <UrgentPanel
          items={view.urgent}
          pending={pending}
          onToggle={(item) => toggle("urgent", item)}
          onDelete={(id) => destroy("urgent", id)}
          onSave={async (id, title) => {
            await run(id, async () => {
              const data = await send(`/api/dashboard/urgent/${id}`, "PATCH", { title });
              if (data.item) put("urgent", data.item);
            });
          }}
          onAdd={(title) =>
            run("add-urgent", async () => {
              const data = await send("/api/dashboard/urgent", "POST", { title });
              if (data.item) put("urgent", data.item);
            })
          }
        />

        <section className="panel" aria-labelledby="week-heading">
          <div className="section-head">
            <h2 id="week-heading">This week</h2>
            <p>Check a task off. It stays done after you reload.</p>
          </div>
          <div className="week-grid">
            {view.weekDays.map((day) => (
              <DayColumn
                key={day.id}
                day={day}
                tasks={view.week.filter((task) => task.day === day.id)}
                pending={pending}
                onToggle={(item) => toggle("week", item)}
                onDelete={(id) => destroy("week", id)}
                onSave={async (id, body) => {
                  await run(id, async () => {
                    const data = await send(`/api/dashboard/week/${id}`, "PATCH", body);
                    if (data.item) put("week", data.item);
                  });
                }}
                onAdd={(title) =>
                  run(`add-${day.id}`, async () => {
                    const data = await send("/api/dashboard/week", "POST", { title, day: day.id });
                    if (data.item) put("week", data.item);
                  })
                }
              />
            ))}
          </div>
        </section>

        <div className="split">
          <StalledPanel
            items={view.stalled}
            pending={pending}
            onToggle={(item) => toggle("stalled", item)}
            onDelete={(id) => destroy("stalled", id)}
            onSave={async (id, body) => {
              await run(id, async () => {
                const data = await send(`/api/dashboard/stalled/${id}`, "PATCH", body);
                if (data.item) put("stalled", data.item);
              });
            }}
            onAdd={(body) =>
              run("add-stalled", async () => {
                const data = await send("/api/dashboard/stalled", "POST", body);
                if (data.item) put("stalled", data.item);
              })
            }
          />
          <ChannelPanel
            items={view.channels}
            pending={pending}
            onToggle={(item) => toggle("channels", item)}
            onDelete={(id) => destroy("channels", id)}
            onSave={async (id, body) => {
              await run(id, async () => {
                const data = await send(`/api/dashboard/channels/${id}`, "PATCH", body);
                if (data.item) put("channels", data.item);
              });
            }}
            onAdd={(body) =>
              run("add-channel", async () => {
                const data = await send("/api/dashboard/channels", "POST", body);
                if (data.item) put("channels", data.item);
              })
            }
          />
        </div>

        <DeadlinePanel
          items={deadlines}
          today={view.today}
          pending={pending}
          onToggle={(item) => toggle("deadlines", item)}
          onDelete={(id) => destroy("deadlines", id)}
          onSave={async (id, body) => {
            await run(id, async () => {
              const data = await send(`/api/dashboard/deadlines/${id}`, "PATCH", body);
              if (data.item) put("deadlines", data.item);
            });
          }}
          onAdd={(body) =>
            run("add-deadline", async () => {
              const data = await send("/api/dashboard/deadlines", "POST", body);
              if (data.item) put("deadlines", data.item);
            })
          }
        />
      </div>
    </main>
  );
}

function UrgentPanel({
  items,
  pending,
  onAdd,
  onToggle,
  onDelete,
  onSave,
}: {
  items: UrgentItem[];
  pending: string | null;
  onAdd: (title: string) => Promise<boolean>;
  onToggle: (item: UrgentItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const open = items.filter((item) => !item.done).length;
  return (
    <section className="panel urgent" aria-labelledby="urgent-heading">
      <div className="section-head">
        <h2 id="urgent-heading">Urgent</h2>
        <p>{open === 0 ? "Nothing needs you right now." : `${open} open`}</p>
      </div>
      {items.length === 0 ? <p className="empty">Add something only if it can't wait.</p> : null}
      <ul className="rows">
        {items.map((item) => (
          <EditableRow
            key={item.id}
            done={item.done}
            title={item.title}
            pending={pending === item.id}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item.id)}
            onSave={(next) => onSave(item.id, next)}
          />
        ))}
      </ul>
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault();
          const next = title.trim();
          if (!next) return;
          void onAdd(next).then((ok) => {
            if (ok) setTitle("");
          });
        }}
      >
        <label className="sr-only" htmlFor="add-urgent">
          Add an urgent item
        </label>
        <input
          id="add-urgent"
          className="inline-input"
          placeholder="Add an urgent item"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={pending === "add-urgent"}>
          Add
        </button>
      </form>
    </section>
  );
}

function DayColumn({
  day,
  tasks,
  pending,
  onAdd,
  onToggle,
  onDelete,
  onSave,
}: {
  day: WeekDayView;
  tasks: WeekTask[];
  pending: string | null;
  onAdd: (title: string) => Promise<boolean>;
  onToggle: (item: WeekTask) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, body: { title: string; notes: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  return (
    <section className={day.isToday ? "day is-today" : "day"} aria-label={day.label}>
      <div className="day-head">
        <strong>{day.label}</strong>
        <span>{day.pretty}</span>
      </div>
      <ul className="day-list">
        {tasks.map((task) => (
          <WeekRow
            key={task.id}
            task={task}
            pending={pending === task.id}
            onToggle={() => onToggle(task)}
            onDelete={() => onDelete(task.id)}
            onSave={(body) => onSave(task.id, body)}
          />
        ))}
      </ul>
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault();
          const next = title.trim();
          if (!next) return;
          void onAdd(next).then((ok) => {
            if (ok) setTitle("");
          });
        }}
      >
        <label className="sr-only" htmlFor={`add-${day.id}`}>
          Add a task for {day.label}
        </label>
        <input
          id={`add-${day.id}`}
          className="inline-input"
          placeholder="Add a task"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="btn btn-ghost" type="submit" disabled={pending === `add-${day.id}`}>
          Add
        </button>
      </form>
    </section>
  );
}

function WeekRow({
  task,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  task: WeekTask;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (body: { title: string; notes: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  if (editing) {
    return (
      <li>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ title, notes }).then(() => setEditing(false));
          }}
        >
          <input className="inline-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <textarea className="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className={task.done ? "item is-done" : "item"}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggle}
        aria-label={task.done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
      />
      <div className="item-main">
        <p className="item-title">{task.title}</p>
        {task.notes ? <p className="meta">{task.notes}</p> : null}
        <div className="item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function EditableRow({
  title,
  done,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  title: string;
  done: boolean;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  if (editing) {
    return (
      <li>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(draft).then(() => setEditing(false));
          }}
        >
          <input className="inline-input" value={draft} onChange={(event) => setDraft(event.target.value)} required />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className={done ? "item is-done" : "item"}>
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={done ? `Mark ${title} not done` : `Mark ${title} done`}
      />
      <div className="item-main">
        <p className="item-title">{title}</p>
        <div className="item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function StalledPanel({
  items,
  pending,
  onAdd,
  onToggle,
  onDelete,
  onSave,
}: {
  items: StalledItem[];
  pending: string | null;
  onAdd: (body: { title: string; blockedOn: string }) => Promise<boolean>;
  onToggle: (item: StalledItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, body: { title: string; blockedOn: string; notes: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [blockedOn, setBlockedOn] = useState("");
  return (
    <section className="panel" aria-labelledby="stalled-heading">
      <div className="section-head">
        <h2 id="stalled-heading">Stalled</h2>
        <p>Waiting on someone or something.</p>
      </div>
      {items.length === 0 ? <p className="empty">Nothing is stuck.</p> : null}
      <ul className="rows">
        {items.map((item) => (
          <StalledRow
            key={item.id}
            item={item}
            pending={pending === item.id}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item.id)}
            onSave={(body) => onSave(item.id, body)}
          />
        ))}
      </ul>
      <form
        className="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onAdd({ title, blockedOn }).then((ok) => {
            if (!ok) return;
            setTitle("");
            setBlockedOn("");
          });
        }}
      >
        <label className="field">
          <span>What's stuck</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="field">
          <span>Blocked on</span>
          <input value={blockedOn} onChange={(event) => setBlockedOn(event.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending === "add-stalled"}>
          Add to the board
        </button>
      </form>
    </section>
  );
}

function StalledRow({
  item,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  item: StalledItem;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (body: { title: string; blockedOn: string; notes: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [blockedOn, setBlockedOn] = useState(item.blockedOn);
  const [notes, setNotes] = useState(item.notes);
  if (editing) {
    return (
      <li>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ title, blockedOn, notes }).then(() => setEditing(false));
          }}
        >
          <input className="inline-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <input className="inline-input" value={blockedOn} onChange={(event) => setBlockedOn(event.target.value)} required />
          <textarea className="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className={item.done ? "item is-done" : "item"}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        aria-label={item.done ? `Mark ${item.title} unblocked` : `Mark ${item.title} resolved`}
      />
      <div className="item-main">
        <p className="item-title">{item.title}</p>
        <p className="blocked">Blocked on {item.blockedOn}</p>
        {item.notes ? <p className="meta">{item.notes}</p> : null}
        <div className="item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function ChannelPanel({
  items,
  pending,
  onAdd,
  onToggle,
  onDelete,
  onSave,
}: {
  items: Channel[];
  pending: string | null;
  onAdd: (body: { name: string; status: string }) => Promise<boolean>;
  onToggle: (item: Channel) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, body: { name: string; status: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  return (
    <section className="panel" aria-labelledby="channels-heading">
      <div className="section-head">
        <h2 id="channels-heading">Channels</h2>
        <p>Where work comes in.</p>
      </div>
      <ul className="rows channel-list">
        {items.map((item) => (
          <ChannelRow
            key={item.id}
            item={item}
            pending={pending === item.id}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item.id)}
            onSave={(body) => onSave(item.id, body)}
          />
        ))}
      </ul>
      <form
        className="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onAdd({ name, status }).then((ok) => {
            if (!ok) return;
            setName("");
            setStatus("");
          });
        }}
      >
        <label className="field">
          <span>Channel</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Status</span>
          <input value={status} onChange={(event) => setStatus(event.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending === "add-channel"}>
          Add channel
        </button>
      </form>
    </section>
  );
}

function ChannelRow({
  item,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  item: Channel;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (body: { name: string; status: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [status, setStatus] = useState(item.status);
  if (editing) {
    return (
      <li>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ name, status }).then(() => setEditing(false));
          }}
        >
          <input className="inline-input" value={name} onChange={(event) => setName(event.target.value)} required />
          <input className="inline-input" value={status} onChange={(event) => setStatus(event.target.value)} required />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className={item.done ? "channel is-done" : "channel"}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        aria-label={item.done ? `Mark ${item.name} as needing attention` : `Mark ${item.name} caught up`}
      />
      <div className="item-main">
        <p className="channel-name">{item.name}</p>
        <p className="channel-status">{item.status}</p>
        <div className="item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function DeadlinePanel({
  items,
  today,
  pending,
  onAdd,
  onToggle,
  onDelete,
  onSave,
}: {
  items: Deadline[];
  today: string;
  pending: string | null;
  onAdd: (body: { title: string; dueAt: string; notes: string }) => Promise<boolean>;
  onToggle: (item: Deadline) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, body: { title: string; dueAt: string; notes: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <section className="panel" aria-labelledby="deadlines-heading">
      <div className="section-head">
        <h2 id="deadlines-heading">Deadlines</h2>
        <p>Soonest first.</p>
      </div>
      {items.length === 0 ? <p className="empty">No dates on the board.</p> : null}
      <ul className="rows">
        {items.map((item) => (
          <DeadlineRow
            key={item.id}
            item={item}
            today={today}
            pending={pending === item.id}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item.id)}
            onSave={(body) => onSave(item.id, body)}
          />
        ))}
      </ul>
      <form
        className="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onAdd({ title, dueAt, notes }).then((ok) => {
            if (!ok) return;
            setTitle("");
            setDueAt("");
            setNotes("");
          });
        }}
      >
        <label className="field">
          <span>What's due</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="field">
          <span>Due date</span>
          <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
        </label>
        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending === "add-deadline"}>
          Add deadline
        </button>
      </form>
    </section>
  );
}

function DeadlineRow({
  item,
  today,
  pending,
  onToggle,
  onDelete,
  onSave,
}: {
  item: Deadline;
  today: string;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (body: { title: string; dueAt: string; notes: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [dueAt, setDueAt] = useState(item.dueAt);
  const [notes, setNotes] = useState(item.notes);
  const label = dueLabel(item.dueAt, today);
  if (editing) {
    return (
      <li>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ title, dueAt, notes }).then(() => setEditing(false));
          }}
        >
          <input className="inline-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <input className="inline-input" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
          <input className="inline-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Save
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className={item.done ? "item is-done" : "item"}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        aria-label={item.done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
      />
      <div className="item-main">
        <p className={label.overdue ? "due overdue" : "due"}>{label.text}</p>
        <p className="item-title">{item.title}</p>
        {item.notes ? <p className="meta">{item.notes}</p> : null}
        <div className="item-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
