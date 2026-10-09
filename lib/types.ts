export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SECTIONS = ["urgent", "week", "stalled", "channels", "deadlines"] as const;
export type Section = (typeof SECTIONS)[number];

export type UrgentItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WeekTask = {
  id: string;
  title: string;
  day: Weekday;
  weekStart: string;
  notes: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StalledItem = {
  id: string;
  title: string;
  blockedOn: string;
  notes: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Channel = {
  id: string;
  name: string;
  status: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Deadline = {
  id: string;
  title: string;
  dueAt: string;
  notes: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DashboardState = {
  urgent: UrgentItem[];
  week: WeekTask[];
  stalled: StalledItem[];
  channels: Channel[];
  deadlines: Deadline[];
};

export type DashboardItem = UrgentItem | WeekTask | StalledItem | Channel | Deadline;

export type RecoveryCodeRecord = {
  hash: string;
  used: boolean;
};

export type UserRecord = {
  username: string;
  passwordHash: string;
  email: string;
  totpSecretEnc: string;
  totpLastStep: number | null;
  recoveryCodes: RecoveryCodeRecord[];
  setupComplete: boolean;
  setupNonceHash: string | null;
  createdAt: string;
};

export type EmailCodeRecord = {
  hash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
  sentAt: number;
};

export type RateLimitRecord = {
  count: number;
  windowStart: number;
};

export type WeekDayView = {
  id: Weekday;
  date: string;
  label: string;
  pretty: string;
  isToday: boolean;
};

export type DashboardView = DashboardState & {
  weekStart: string;
  weekEnd: string;
  weekDays: WeekDayView[];
  today: string;
  timeZone: string;
};
