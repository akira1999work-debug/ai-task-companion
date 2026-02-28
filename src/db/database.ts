import type { SQLiteDatabase } from 'expo-sqlite';
import type { Task, SubTask, ChatMessage, TaskType, RescheduleReason } from '../types';
import type { TaskCategory, UserProfile, ScalingWeight } from '../types/onboarding';

// ---------------------------------------------------------------------------
// Row types — SQLite から返される生の行データ
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: number;
  due_date: string | null;
  priority: string;
  is_recurring: number;
  recurring_pattern: string | null;
  created_at: string;
  task_type: string;
  completed_at: string | null;
  original_due_date: string | null;
  reschedule_count: number;
  category_id: string | null;
}

interface RescheduleHistoryRow {
  id: string;
  reason: string;
  task_ids: string;
  created_at: string;
}

interface SubTaskRow {
  id: string;
  task_id: string;
  title: string;
  completed: number;
}

interface ChatMessageRow {
  id: string;
  user_id: string;
  text: string;
  sender: string;
  timestamp: string;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: number;
  scaling_weight: string;
  parent_id: string | null;
}

interface UserProfileRow {
  id: string;
  onboarding_raw: string;
  occupation: string | null;
  side_work: string | null;
  interests: string;
  goals: string;
  age_group: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ID 生成 — 将来のクラウド同期に備えた UUID ベースの ID
// ---------------------------------------------------------------------------

export function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 型変換ユーティリティ — SQLite INTEGER(0/1) ↔ TypeScript boolean
// ---------------------------------------------------------------------------

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: number): boolean {
  return value === 1;
}

export function mapRowToSubTask(row: SubTaskRow): SubTask {
  return {
    id: row.id,
    title: row.title,
    completed: intToBool(row.completed),
  };
}

export function mapRowToTask(row: TaskRow, subTasks: SubTask[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completed: intToBool(row.completed),
    dueDate: row.due_date ?? undefined,
    priority: row.priority as Task['priority'],
    isRecurring: intToBool(row.is_recurring),
    recurringPattern: (row.recurring_pattern ?? undefined) as Task['recurringPattern'],
    subTasks,
    createdAt: row.created_at,
    taskType: (row.task_type || 'normal') as TaskType,
    completedAt: row.completed_at ?? undefined,
    originalDueDate: row.original_due_date ?? undefined,
    rescheduleCount: row.reschedule_count || 0,
    categoryId: row.category_id ?? undefined,
  };
}

export function mapRowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    text: row.text,
    sender: row.sender as ChatMessage['sender'],
    timestamp: row.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Schema initialisation (called by SQLiteProvider onInit)
// ---------------------------------------------------------------------------

const DEFAULT_USER_ID = 'local_user';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                TEXT PRIMARY KEY NOT NULL,
      user_id           TEXT NOT NULL DEFAULT '${DEFAULT_USER_ID}',
      title             TEXT NOT NULL,
      description       TEXT,
      completed         INTEGER NOT NULL DEFAULT 0,
      due_date          TEXT,
      priority          TEXT NOT NULL DEFAULT 'medium',
      is_recurring      INTEGER NOT NULL DEFAULT 0,
      recurring_pattern TEXT,
      created_at        TEXT NOT NULL,
      task_type         TEXT NOT NULL DEFAULT 'normal',
      completed_at      TEXT,
      original_due_date TEXT,
      reschedule_count  INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: add new columns to existing tables (safe — IF NOT EXISTS not
  // supported for ALTER TABLE, so we catch and ignore if already present)
  const migrations = [
    "ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'normal'",
    'ALTER TABLE tasks ADD COLUMN completed_at TEXT',
    'ALTER TABLE tasks ADD COLUMN original_due_date TEXT',
    'ALTER TABLE tasks ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN category_id TEXT',
    'ALTER TABLE categories ADD COLUMN parent_id TEXT',
  ];
  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sub_tasks (
      id        TEXT PRIMARY KEY NOT NULL,
      task_id   TEXT NOT NULL,
      title     TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id        TEXT PRIMARY KEY NOT NULL,
      user_id   TEXT NOT NULL DEFAULT '${DEFAULT_USER_ID}',
      text      TEXT NOT NULL,
      sender    TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reschedule_history (
      id         TEXT PRIMARY KEY NOT NULL,
      reason     TEXT NOT NULL,
      task_ids   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id              TEXT PRIMARY KEY NOT NULL,
      name            TEXT NOT NULL,
      icon            TEXT NOT NULL DEFAULT 'folder-outline',
      color           TEXT NOT NULL DEFAULT '#9CA3AF',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      is_default      INTEGER NOT NULL DEFAULT 0,
      scaling_weight  TEXT NOT NULL DEFAULT 'normal'
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id              TEXT PRIMARY KEY NOT NULL,
      onboarding_raw  TEXT NOT NULL DEFAULT '',
      occupation      TEXT,
      side_work       TEXT,
      interests       TEXT NOT NULL DEFAULT '[]',
      goals           TEXT NOT NULL DEFAULT '[]',
      age_group       TEXT,
      created_at      TEXT NOT NULL
    );
  `);

  // Default settings (only inserted when the key doesn't already exist)
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'personality',
    'standard',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'googleCalendarEnabled',
    'false',
  );

  // AI provider defaults
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'connectionMode',
    'hybrid',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'ollamaHost',
    '127.0.0.1',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'ollamaPort',
    '11434',
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
    'geminiApiKey',
    '',
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function getAllTasks(db: SQLiteDatabase): Promise<Task[]> {
  const taskRows = await db.getAllAsync<TaskRow>(
    'SELECT * FROM tasks ORDER BY created_at DESC',
  );

  const subTaskRows = await db.getAllAsync<SubTaskRow>(
    'SELECT * FROM sub_tasks',
  );

  const subTasksByTaskId = new Map<string, SubTask[]>();
  for (const row of subTaskRows) {
    const list = subTasksByTaskId.get(row.task_id) || [];
    list.push(mapRowToSubTask(row));
    subTasksByTaskId.set(row.task_id, list);
  }

  return taskRows.map((row) =>
    mapRowToTask(row, subTasksByTaskId.get(row.id) || []),
  );
}

export async function insertTask(db: SQLiteDatabase, task: Task): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tasks (id, user_id, title, description, completed, due_date, priority, is_recurring, recurring_pattern, created_at, task_type, completed_at, original_due_date, reschedule_count, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.id,
      DEFAULT_USER_ID,
      task.title,
      task.description ?? null,
      boolToInt(task.completed),
      task.dueDate ?? null,
      task.priority,
      boolToInt(task.isRecurring),
      task.recurringPattern ?? null,
      task.createdAt,
      task.taskType || 'normal',
      task.completedAt ?? null,
      task.originalDueDate ?? task.dueDate ?? null,
      task.rescheduleCount || 0,
      task.categoryId ?? null,
    );

    for (const sub of task.subTasks) {
      await db.runAsync(
        'INSERT INTO sub_tasks (id, task_id, title, completed) VALUES (?, ?, ?, ?)',
        sub.id,
        task.id,
        sub.title,
        boolToInt(sub.completed),
      );
    }
  });
}

export async function updateTaskCompleted(
  db: SQLiteDatabase,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const completedAt = completed ? new Date().toISOString() : null;
  await db.runAsync(
    'UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?',
    boolToInt(completed),
    completedAt,
    taskId,
  );
}

export async function deleteTaskById(db: SQLiteDatabase, taskId: string): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', taskId);
}

export async function bulkRescheduleTasks(
  db: SQLiteDatabase,
  updates: { id: string; dueDate: string }[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const u of updates) {
      await db.runAsync(
        'UPDATE tasks SET due_date = ?, reschedule_count = reschedule_count + 1 WHERE id = ?',
        u.dueDate,
        u.id,
      );
    }
  });
}

export async function updateTaskCategory(
  db: SQLiteDatabase,
  taskId: string,
  categoryId: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE tasks SET category_id = ? WHERE id = ?',
    categoryId,
    taskId,
  );
}

// ---------------------------------------------------------------------------
// Reschedule history
// ---------------------------------------------------------------------------

export async function insertRescheduleRecord(
  db: SQLiteDatabase,
  id: string,
  reason: RescheduleReason,
  taskIds: string[],
): Promise<void> {
  await db.runAsync(
    'INSERT INTO reschedule_history (id, reason, task_ids, created_at) VALUES (?, ?, ?, ?)',
    id,
    reason,
    JSON.stringify(taskIds),
    new Date().toISOString(),
  );
}

// ---------------------------------------------------------------------------
// Scoring queries
// ---------------------------------------------------------------------------

interface CompletionStatsRow {
  task_type: string;
  total: number;
  completed: number;
}

export async function getCompletionStatsByType(
  db: SQLiteDatabase,
  sinceDaysAgo: number,
): Promise<CompletionStatsRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceStr = since.toISOString().split('T')[0];

  return db.getAllAsync<CompletionStatsRow>(
    `SELECT
       task_type,
       COUNT(*) as total,
       SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
     FROM tasks
     WHERE created_at >= ? OR due_date >= ?
     GROUP BY task_type`,
    sinceStr,
    sinceStr,
  );
}

interface DailyCompletionRow {
  day: string;
  total: number;
  completed: number;
}

export async function getDailyCompletionRates(
  db: SQLiteDatabase,
  sinceDaysAgo: number,
): Promise<DailyCompletionRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceStr = since.toISOString().split('T')[0];

  return db.getAllAsync<DailyCompletionRow>(
    `SELECT
       COALESCE(due_date, DATE(created_at)) as day,
       COUNT(*) as total,
       SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
     FROM tasks
     WHERE (due_date >= ? OR (due_date IS NULL AND created_at >= ?))
     GROUP BY day
     ORDER BY day ASC`,
    sinceStr,
    sinceStr,
  );
}

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

export async function getAllChatMessages(db: SQLiteDatabase): Promise<ChatMessage[]> {
  const rows = await db.getAllAsync<ChatMessageRow>(
    'SELECT * FROM chat_messages ORDER BY timestamp ASC',
  );

  return rows.map(mapRowToChatMessage);
}

export async function insertChatMessage(
  db: SQLiteDatabase,
  message: ChatMessage,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO chat_messages (id, user_id, text, sender, timestamp) VALUES (?, ?, ?, ?, ?)',
    message.id,
    DEFAULT_USER_ID,
    message.text,
    message.sender,
    message.timestamp,
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row ? row.value : null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function mapRowToCategory(row: CategoryRow): TaskCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isDefault: intToBool(row.is_default),
    scalingWeight: row.scaling_weight as ScalingWeight,
    parentId: row.parent_id ?? null,
  };
}

export async function getAllCategories(db: SQLiteDatabase): Promise<TaskCategory[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY sort_order ASC',
  );
  return rows.map(mapRowToCategory);
}

export async function insertCategory(db: SQLiteDatabase, cat: TaskCategory): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO categories (id, name, icon, color, sort_order, is_default, scaling_weight, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    cat.id,
    cat.name,
    cat.icon,
    cat.color,
    cat.sortOrder,
    boolToInt(cat.isDefault),
    cat.scalingWeight,
    cat.parentId ?? null,
  );
}

export async function bulkInsertCategories(db: SQLiteDatabase, cats: TaskCategory[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const cat of cats) {
      await db.runAsync(
        'INSERT OR REPLACE INTO categories (id, name, icon, color, sort_order, is_default, scaling_weight, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        cat.id,
        cat.name,
        cat.icon,
        cat.color,
        cat.sortOrder,
        boolToInt(cat.isDefault),
        cat.scalingWeight,
        cat.parentId ?? null,
      );
    }
  });
}

export async function getCategoryCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM categories');
  return row ? row.cnt : 0;
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

function mapRowToUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    onboardingRaw: row.onboarding_raw,
    occupation: row.occupation,
    sideWork: row.side_work,
    interests: JSON.parse(row.interests || '[]'),
    goals: JSON.parse(row.goals || '[]'),
    ageGroup: row.age_group,
    createdAt: row.created_at,
  };
}

export async function getUserProfile(db: SQLiteDatabase): Promise<UserProfile | null> {
  const row = await db.getFirstAsync<UserProfileRow>('SELECT * FROM user_profiles LIMIT 1');
  return row ? mapRowToUserProfile(row) : null;
}

export async function insertUserProfile(db: SQLiteDatabase, profile: UserProfile): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO user_profiles (id, onboarding_raw, occupation, side_work, interests, goals, age_group, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    profile.id,
    profile.onboardingRaw,
    profile.occupation ?? null,
    profile.sideWork ?? null,
    JSON.stringify(profile.interests),
    JSON.stringify(profile.goals),
    profile.ageGroup ?? null,
    profile.createdAt,
  );
}
