import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/errors";
import { optionalBoolean, requireString } from "@/lib/http";
import { getKv } from "@/lib/store";
import type {
  Channel,
  DashboardItem,
  DashboardState,
  DashboardView,
  Deadline,
  Section,
  StalledItem,
  UrgentItem,
  WeekTask,
} from "@/lib/types";
import { SECTIONS } from "@/lib/types";
import { addDays, buildWeekDays, currentWeekStart, dashboardTimeZone, isMonday, isValidDate, isWeekday, todayIso } from "@/lib/week";

const KEY = "dashboard";

export function emptyDashboard(): DashboardState {
  return { urgent: [], week: [], stalled: [], channels: [], deadlines: [] };
}

export function parseSection(section: string): Section {
  if ((SECTIONS as readonly string[]).includes(section)) {
    return section as Section;
  }
  throw new HttpError(404, "Unknown section.");
}

function stamp(now: number): string {
  return new Date(now).toISOString();
}

function byCreated<T extends { createdAt: string }>(a: T, b: T): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function openFirst<T extends { done: boolean; createdAt: string }>(a: T, b: T): number {
  if (a.done !== b.done) {
    return a.done ? 1 : -1;
  }
  return byCreated(a, b);
}

export function sortDeadlines(items: Deadline[]): Deadline[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    return a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title);
  });
}

export async function getDashboardState(): Promise<DashboardState> {
  return (await getKv().get<DashboardState>(KEY)) ?? emptyDashboard();
}

async function mutate(fn: (state: DashboardState) => DashboardState): Promise<DashboardState> {
  const next = await getKv().update<DashboardState>(KEY, (current) => fn(current ?? emptyDashboard()));
  return next ?? emptyDashboard();
}

export async function seedDashboard(now = Date.now()): Promise<void> {
  const existing = await getKv().get<DashboardState>(KEY);
  if (existing) {
    return;
  }
  const createdAt = stamp(now);
  const channel = (name: string, status: string): Channel => ({
    id: randomUUID(),
    name,
    status,
    done: false,
    createdAt,
    updatedAt: createdAt,
  });
  await getKv().set(KEY, {
    ...emptyDashboard(),
    channels: [
      channel("WhatsApp", "Quiet"),
      channel("Email", "Inbox clear"),
      channel("School LMS", "Nothing new"),
    ],
  });
}

export async function getUiView(now = Date.now()): Promise<DashboardView> {
  const state = await getDashboardState();
  const timeZone = dashboardTimeZone();
  const date = new Date(now);
  const weekStart = currentWeekStart(timeZone, date);
  return {
    urgent: [...state.urgent].sort(openFirst),
    week: state.week.filter((task) => task.weekStart === weekStart).sort(byCreated),
    stalled: [...state.stalled].sort(openFirst),
    channels: state.channels,
    deadlines: sortDeadlines(state.deadlines),
    weekStart,
    weekEnd: addDays(weekStart, 6),
    weekDays: buildWeekDays(timeZone, date),
    today: todayIso(timeZone, date),
    timeZone,
  };
}

export async function getBotState(now = Date.now()) {
  const state = await getDashboardState();
  const timeZone = dashboardTimeZone();
  const date = new Date(now);
  const weekStart = currentWeekStart(timeZone, date);
  return {
    state: {
      urgent: [...state.urgent].sort(openFirst),
      week: [...state.week].sort(byCreated),
      stalled: [...state.stalled].sort(openFirst),
      channels: state.channels,
      deadlines: sortDeadlines(state.deadlines),
    },
    weekStart,
    weekEnd: addDays(weekStart, 6),
    today: todayIso(timeZone, date),
    timeZone,
  };
}

function weekStartFor(input: Record<string, unknown>, now: number): string {
  const explicit = input.weekStart;
  if (explicit === undefined) {
    return currentWeekStart(dashboardTimeZone(), new Date(now));
  }
  if (typeof explicit !== "string" || !isMonday(explicit)) {
    throw new HttpError(400, "weekStart must be a Monday in YYYY-MM-DD form.");
  }
  return explicit;
}

function buildUrgent(input: Record<string, unknown>, now: number): UrgentItem {
  const createdAt = stamp(now);
  return {
    id: randomUUID(),
    title: requireString(input, "title", 200)!,
    done: optionalBoolean(input, "done") ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildWeek(input: Record<string, unknown>, now: number): WeekTask {
  const day = requireString(input, "day", 3)!;
  if (!isWeekday(day)) {
    throw new HttpError(400, "day must be mon, tue, wed, thu, fri, sat, or sun.");
  }
  const createdAt = stamp(now);
  return {
    id: randomUUID(),
    title: requireString(input, "title", 200)!,
    day,
    weekStart: weekStartFor(input, now),
    notes: requireString(input, "notes", 2000, false) ?? "",
    done: optionalBoolean(input, "done") ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildStalled(input: Record<string, unknown>, now: number): StalledItem {
  const createdAt = stamp(now);
  return {
    id: randomUUID(),
    title: requireString(input, "title", 200)!,
    blockedOn: requireString(input, "blockedOn", 200)!,
    notes: requireString(input, "notes", 2000, false) ?? "",
    done: optionalBoolean(input, "done") ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildChannel(input: Record<string, unknown>, now: number): Channel {
  const createdAt = stamp(now);
  return {
    id: randomUUID(),
    name: requireString(input, "name", 80)!,
    status: requireString(input, "status", 280)!,
    done: optionalBoolean(input, "done") ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildDeadline(input: Record<string, unknown>, now: number): Deadline {
  const dueAt = requireString(input, "dueAt", 10)!;
  if (!isValidDate(dueAt)) {
    throw new HttpError(400, "dueAt must be a real date in YYYY-MM-DD form.");
  }
  const createdAt = stamp(now);
  return {
    id: randomUUID(),
    title: requireString(input, "title", 200)!,
    dueAt,
    notes: requireString(input, "notes", 2000, false) ?? "",
    done: optionalBoolean(input, "done") ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function createItem(section: string, input: Record<string, unknown>, now = Date.now()): Promise<DashboardItem> {
  const kind = parseSection(section);
  const item =
    kind === "urgent"
      ? buildUrgent(input, now)
      : kind === "week"
        ? buildWeek(input, now)
        : kind === "stalled"
          ? buildStalled(input, now)
          : kind === "channels"
            ? buildChannel(input, now)
            : buildDeadline(input, now);

  await mutate((state) => {
    if (kind === "urgent") return { ...state, urgent: [...state.urgent, item as UrgentItem] };
    if (kind === "week") return { ...state, week: [...state.week, item as WeekTask] };
    if (kind === "stalled") return { ...state, stalled: [...state.stalled, item as StalledItem] };
    if (kind === "channels") return { ...state, channels: [...state.channels, item as Channel] };
    return { ...state, deadlines: [...state.deadlines, item as Deadline] };
  });
  return item;
}

function applyUrgent(item: UrgentItem, input: Record<string, unknown>, now: number): UrgentItem {
  return {
    ...item,
    title: requireString(input, "title", 200, false) ?? item.title,
    done: optionalBoolean(input, "done") ?? item.done,
    updatedAt: stamp(now),
  };
}

function applyWeek(item: WeekTask, input: Record<string, unknown>, now: number): WeekTask {
  const day = requireString(input, "day", 3, false);
  if (day && !isWeekday(day)) {
    throw new HttpError(400, "day must be mon, tue, wed, thu, fri, sat, or sun.");
  }
  const weekStart = input.weekStart === undefined ? item.weekStart : weekStartFor(input, now);
  return {
    ...item,
    title: requireString(input, "title", 200, false) ?? item.title,
    day: day && isWeekday(day) ? day : item.day,
    weekStart,
    notes: input.notes === undefined ? item.notes : (requireString(input, "notes", 2000, false) ?? ""),
    done: optionalBoolean(input, "done") ?? item.done,
    updatedAt: stamp(now),
  };
}

function applyStalled(item: StalledItem, input: Record<string, unknown>, now: number): StalledItem {
  return {
    ...item,
    title: requireString(input, "title", 200, false) ?? item.title,
    blockedOn: requireString(input, "blockedOn", 200, false) ?? item.blockedOn,
    notes: input.notes === undefined ? item.notes : (requireString(input, "notes", 2000, false) ?? ""),
    done: optionalBoolean(input, "done") ?? item.done,
    updatedAt: stamp(now),
  };
}

function applyChannel(item: Channel, input: Record<string, unknown>, now: number): Channel {
  return {
    ...item,
    name: requireString(input, "name", 80, false) ?? item.name,
    status: requireString(input, "status", 280, false) ?? item.status,
    done: optionalBoolean(input, "done") ?? item.done,
    updatedAt: stamp(now),
  };
}

function applyDeadline(item: Deadline, input: Record<string, unknown>, now: number): Deadline {
  const dueAt = requireString(input, "dueAt", 10, false);
  if (dueAt && !isValidDate(dueAt)) {
    throw new HttpError(400, "dueAt must be a real date in YYYY-MM-DD form.");
  }
  return {
    ...item,
    title: requireString(input, "title", 200, false) ?? item.title,
    dueAt: dueAt ?? item.dueAt,
    notes: input.notes === undefined ? item.notes : (requireString(input, "notes", 2000, false) ?? ""),
    done: optionalBoolean(input, "done") ?? item.done,
    updatedAt: stamp(now),
  };
}

export async function updateItem(
  section: string,
  id: string,
  input: Record<string, unknown>,
  now = Date.now(),
): Promise<DashboardItem> {
  const kind = parseSection(section);
  let updated: DashboardItem | null = null;
  await mutate((state) => {
    if (kind === "urgent") {
      const index = state.urgent.findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, "Item not found.");
      const next = applyUrgent(state.urgent[index]!, input, now);
      updated = next;
      const urgent = state.urgent.slice();
      urgent[index] = next;
      return { ...state, urgent };
    }
    if (kind === "week") {
      const index = state.week.findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, "Item not found.");
      const next = applyWeek(state.week[index]!, input, now);
      updated = next;
      const week = state.week.slice();
      week[index] = next;
      return { ...state, week };
    }
    if (kind === "stalled") {
      const index = state.stalled.findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, "Item not found.");
      const next = applyStalled(state.stalled[index]!, input, now);
      updated = next;
      const stalled = state.stalled.slice();
      stalled[index] = next;
      return { ...state, stalled };
    }
    if (kind === "channels") {
      const index = state.channels.findIndex((item) => item.id === id);
      if (index < 0) throw new HttpError(404, "Item not found.");
      const next = applyChannel(state.channels[index]!, input, now);
      updated = next;
      const channels = state.channels.slice();
      channels[index] = next;
      return { ...state, channels };
    }
    const index = state.deadlines.findIndex((item) => item.id === id);
    if (index < 0) throw new HttpError(404, "Item not found.");
    const next = applyDeadline(state.deadlines[index]!, input, now);
    updated = next;
    const deadlines = state.deadlines.slice();
    deadlines[index] = next;
    return { ...state, deadlines };
  });
  if (!updated) {
    throw new HttpError(404, "Item not found.");
  }
  return updated;
}

export async function completeItem(section: string, id: string, now = Date.now()): Promise<DashboardItem> {
  return updateItem(section, id, { done: true }, now);
}

export async function deleteItem(section: string, id: string): Promise<void> {
  const kind = parseSection(section);
  let found = false;
  await mutate((state) => {
    if (kind === "urgent") {
      found = state.urgent.some((item) => item.id === id);
      return { ...state, urgent: state.urgent.filter((item) => item.id !== id) };
    }
    if (kind === "week") {
      found = state.week.some((item) => item.id === id);
      return { ...state, week: state.week.filter((item) => item.id !== id) };
    }
    if (kind === "stalled") {
      found = state.stalled.some((item) => item.id === id);
      return { ...state, stalled: state.stalled.filter((item) => item.id !== id) };
    }
    if (kind === "channels") {
      found = state.channels.some((item) => item.id === id);
      return { ...state, channels: state.channels.filter((item) => item.id !== id) };
    }
    found = state.deadlines.some((item) => item.id === id);
    return { ...state, deadlines: state.deadlines.filter((item) => item.id !== id) };
  });
  if (!found) {
    throw new HttpError(404, "Item not found.");
  }
}
