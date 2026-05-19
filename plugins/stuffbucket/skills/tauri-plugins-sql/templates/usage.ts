import Database from '@tauri-apps/plugin-sql';

type Todo = { id: number; title: string; done: number; created_at: string | null };

let db: Database | null = null;

export async function getDb() {
  if (!db) db = await Database.load('sqlite:app.db');
  return db;
}

export async function listOpenTodos(): Promise<Todo[]> {
  const d = await getDb();
  return d.select<Todo[]>(
    'SELECT id, title, done, created_at FROM todos WHERE done = $1 ORDER BY id DESC',
    [0],
  );
}

export async function addTodo(title: string): Promise<number> {
  const d = await getDb();
  const res = await d.execute(
    'INSERT INTO todos (title, created_at) VALUES ($1, $2)',
    [title, new Date().toISOString()],
  );
  return res.lastInsertId as number;
}

export async function setDone(id: number, done: boolean) {
  const d = await getDb();
  await d.execute(
    'UPDATE todos SET done = $1 WHERE id = $2',
    [done ? 1 : 0, id],
  );
}

// MySQL placeholders would be `?` instead of `$1`:
//   'UPDATE todos SET done = ? WHERE id = ?'
