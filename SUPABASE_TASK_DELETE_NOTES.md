# Supabase Task Deletion Notes

A manual SQL script is **not** strictly required for the new delete functionality to work. 

The application utilizes standard Supabase Row-Level Security (RLS) and the JavaScript client to perform the deletion directly:
1. `supabase.from('task_attachments').delete().eq('task_id', id)`
2. `supabase.from('task_comments').delete().eq('task_id', id)`
3. `supabase.from('tasks').delete().eq('id', id)`

Because we delete the child records (comments/attachments) first in `TaskContext.tsx`, we avoid hitting foreign key constraint violations entirely. 

If you *wanted* the database to do this automatically without the client-side steps, you could run this optional SQL script in your Supabase SQL Editor to enforce `ON DELETE CASCADE`:

```sql
-- Optional: Enable Cascade Deleting for Tasks
ALTER TABLE task_comments
DROP CONSTRAINT task_comments_task_id_fkey,
ADD CONSTRAINT task_comments_task_id_fkey
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE task_attachments
DROP CONSTRAINT task_attachments_task_id_fkey,
ADD CONSTRAINT task_attachments_task_id_fkey
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
```
